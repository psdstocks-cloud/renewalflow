<?php
/**
 * Plugin Name: Artly Reminder Bridge
 * Description: Syncs WooCommerce Points & Rewards and Subscriptions data into the Artly Reminder Engine with cron and manual sync.
 * Version: 1.3.0
 * Author: Artly
 */

if (!defined('ABSPATH')) {
  exit;
}

const ARB_LAST_LOG_ID_OPTION = '_artly_last_woo_points_log_id';
const ARB_LAST_SYNC_TIME_OPTION = '_artly_last_points_sync_time';
const ARB_ENGINE_URL_OPTION = '_artly_reminder_engine_url';
const ARB_ENGINE_SECRET_OPTION = '_artly_reminder_engine_secret';
const ARB_CRON_HOOK = 'artly_points_sync_cron';
const ARB_LAST_SYNC_RESULT = '_artly_last_sync_result';
const ARB_LAST_SYNC_ERROR = '_artly_last_sync_error';
const ARB_SYNC_PROGRESS_OPTION = '_artly_sync_progress';
const ARB_SYNC_CANCEL_FLAG = '_artly_sync_cancel';
const ARB_FULL_SYNC_PROGRESS_OPTION = '_artly_full_sync_progress';

register_activation_hook(__FILE__, 'artly_reminder_bridge_activate');
function artly_reminder_bridge_activate(): void
{
  if (!wp_next_scheduled(ARB_CRON_HOOK)) {
    wp_schedule_event(time(), 'hourly', ARB_CRON_HOOK);
  }

  add_option(ARB_LAST_LOG_ID_OPTION, 0);
  add_option(ARB_LAST_SYNC_TIME_OPTION, null);
  add_option(ARB_ENGINE_URL_OPTION, 'https://renewalflow-production.up.railway.app');
  add_option(ARB_ENGINE_SECRET_OPTION, '');
}

// Hourly cron syncs only incremental changes
add_action(ARB_CRON_HOOK, 'artly_sync_points_changes_from_woo');

function artly_reminder_bridge_get_points_table(\wpdb $wpdb): string
{
  return $wpdb->prefix . 'wc_points_rewards_user_points_log';
}

function artly_reminder_bridge_points_table_exists(\wpdb $wpdb): bool
{
  $table_name = artly_reminder_bridge_get_points_table($wpdb);
  return (bool) $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $table_name));
}

function artly_reminder_bridge_log(string $message): void
{
  if (function_exists('wc_get_logger')) {
    $logger = wc_get_logger();
    $logger->info($message, array('source' => 'artly-reminder-bridge'));
  } else {
    error_log('[artly-reminder-bridge] ' . $message);
  }
}

function artly_reminder_bridge_fetch_events_batch(\wpdb $wpdb, int $last_id): array
{
  $table_name = artly_reminder_bridge_get_points_table($wpdb);
  $query = $wpdb->prepare("SELECT * FROM {$table_name} WHERE id > %d ORDER BY id ASC LIMIT 500", $last_id);

  return $wpdb->get_results($query);
}

function artly_reminder_bridge_build_payload_item($row): ?array
{
  if (empty($row->user_id)) {
    return null;
  }

  $user = get_userdata((int) $row->user_id);
  if (!$user || empty($user->user_email)) {
    return null;
  }

  $points_delta = (int) $row->points;
  $event_type = $points_delta > 0 ? 'points_charging' : 'redeem';
  $source = (isset($row->event) && is_string($row->event) && str_contains(strtolower($row->event), 'subscription')) ? 'subscription_renewal' : 'one_time_purchase';

  return array(
    'external_event_id' => (int) $row->id,
    'wp_user_id' => (int) $row->user_id,
    'email' => $user->user_email,
    'points_delta' => $points_delta,
    'event_type' => $event_type,
    'source' => $source,
    'order_id' => isset($row->order_id) ? (string) $row->order_id : null,
    'created_at' => isset($row->date) ? gmdate('c', strtotime((string) $row->date)) : gmdate('c'),
  );
}

function artly_reminder_bridge_post_to_api(string $endpoint, array $payload): ?array
{
  $api_url = get_option(ARB_ENGINE_URL_OPTION);
  $api_secret = get_option(ARB_ENGINE_SECRET_OPTION);

  if (empty($api_url) || empty($api_secret)) {
    $error_msg = 'API URL or Secret not configured. Please configure in WordPress admin → WooCommerce → Artly Reminder Sync.';
    artly_reminder_bridge_log($error_msg);
    update_option(ARB_LAST_SYNC_ERROR, $error_msg);
    return null;
  }

  // Ensure URL doesn't have trailing slash and endpoint doesn't start with /
  $api_url = rtrim($api_url, '/');
  $endpoint = ltrim($endpoint, '/');
  $full_url = $api_url . '/' . $endpoint;

  artly_reminder_bridge_log('Sending request to: ' . $full_url);
  artly_reminder_bridge_log('Payload size: ' . count($payload) . ' items');

  // Optimized HTTP settings (Plan 1: Quick Wins)
  // Connection pooling and keep-alive for faster batch processing
  $http_args = array(
    'headers' => array(
      'Content-Type' => 'application/json',
      'x-artly-secret' => trim($api_secret), // Trim any whitespace
      'Connection' => 'keep-alive', // Reuse connections
    ),
    'body' => wp_json_encode($payload),
    'timeout' => 600, // 10 minutes timeout for larger batches (increased from 5 min)
    'blocking' => true,
    'httpversion' => '1.1', // Use HTTP/1.1 for keep-alive support
  );

  // Add cURL options for connection reuse (if available)
  if (function_exists('curl_init')) {
    add_filter('http_request_args', function($args, $url) use ($full_url) {
      if ($url === $full_url) {
        $args['curl'] = array(
          CURLOPT_TCP_KEEPALIVE => 1,
          CURLOPT_TCP_KEEPIDLE => 30,
          CURLOPT_TCP_KEEPINTVL => 10,
        );
      }
      return $args;
    }, 10, 2);
  }

  // Ensure header name is correct (Express normalizes to lowercase)
  $response = wp_remote_post($full_url, $http_args);
  
  // Remove filter after use
  if (function_exists('curl_init')) {
    remove_all_filters('http_request_args');
  }

  // Log the header being sent for debugging
  artly_reminder_bridge_log('Request headers: x-artly-secret=' . substr($api_secret, 0, 20) . '...');

  if (is_wp_error($response)) {
    $error_msg = 'Error syncing to ' . $endpoint . ': ' . $response->get_error_message();
    artly_reminder_bridge_log($error_msg);
    update_option(ARB_LAST_SYNC_ERROR, $error_msg);
    return null;
  }

  $code = wp_remote_retrieve_response_code($response);
  $body = wp_remote_retrieve_body($response);

  if ($code >= 300) {
    $error_msg = 'Sync to ' . $endpoint . ' failed with status ' . $code;
    if ($code === 401) {
      $error_msg .= ' - Unauthorized. Please check your API key is correct and matches the one in your RenewalFlow dashboard.';
      $error_msg .= ' If the server was recently updated, it may need to be restarted to register new routes.';
    } else if ($code === 404) {
      $error_msg .= ' - Endpoint not found. The server may need to be restarted to register new routes.';
    }
    $error_msg .= ' Response: ' . $body;
    artly_reminder_bridge_log($error_msg);
    artly_reminder_bridge_log('Request URL: ' . $full_url);
    artly_reminder_bridge_log('API Key length: ' . strlen($api_secret));
    artly_reminder_bridge_log('API Key prefix: ' . substr($api_secret, 0, 30));
    update_option(ARB_LAST_SYNC_ERROR, $error_msg);
    return null;
  }

  // Clear error on success
  update_option(ARB_LAST_SYNC_ERROR, '');
  return json_decode($body, true);
}

function artly_reminder_bridge_post_events(array $events): ?array
{
  return artly_reminder_bridge_post_to_api('artly/sync/points-events', $events);
}

function artly_reminder_bridge_post_balances(array $balances): ?array
{
  return artly_reminder_bridge_post_to_api('artly/sync/points-balances', $balances);
}

function artly_reminder_bridge_start_balance_sync(array $balances): ?array
{
  return artly_reminder_bridge_post_to_api('artly/sync/points-balances/start', $balances);
}

function artly_reminder_bridge_get_sync_status(string $job_id): ?array
{
  $api_url = get_option(ARB_ENGINE_URL_OPTION);
  $api_secret = get_option(ARB_ENGINE_SECRET_OPTION);

  if (empty($api_url) || empty($api_secret)) {
    return null;
  }

  $url = rtrim($api_url, '/') . '/artly/sync/points-balances/status?jobId=' . urlencode($job_id);

  $response = wp_remote_get($url, array(
    'headers' => array(
      'x-artly-secret' => $api_secret,
      'Content-Type' => 'application/json',
    ),
    'timeout' => 30,
  ));

  if (is_wp_error($response)) {
    artly_reminder_bridge_log('Error checking sync status: ' . $response->get_error_message());
    return null;
  }

  $code = wp_remote_retrieve_response_code($response);
  $body = wp_remote_retrieve_body($response);

  if ($code >= 300) {
    artly_reminder_bridge_log('Failed to get sync status: ' . $code . ' - ' . $body);
    return null;
  }

  return json_decode($body, true);
}

function artly_reminder_bridge_post_changes(array $changes): ?array
{
  return artly_reminder_bridge_post_to_api('artly/sync/points-changes', $changes);
}

// --- Custom Sync Endpoint (Added v1.2.0) ---

add_action('rest_api_init', 'artly_register_sync_route');

function artly_register_sync_route()
{
  register_rest_route('artly/v1', '/sync', array(
    'methods' => 'GET',
    'callback' => 'artly_handle_sync_request',
    'permission_callback' => '__return_true', // Validation inside handler for simpler auth
  ));

  // Full sync endpoint (v1.2.0) - triggers all syncs (users, points, charges)
  register_rest_route('artly/v1', '/sync-all', array(
    'methods' => 'POST',
    'callback' => 'artly_handle_full_sync_request',
    'permission_callback' => function () {
      // Check for API key in header
      $api_key = isset($_SERVER['HTTP_X_ARTLY_SECRET']) ? $_SERVER['HTTP_X_ARTLY_SECRET'] : '';
      $stored_secret = get_option(ARB_ENGINE_SECRET_OPTION);
      return !empty($api_key) && $api_key === $stored_secret;
    },
  ));

  // Full sync progress endpoint (v1.2.0) - get live progress updates
  register_rest_route('artly/v1', '/sync-all/progress', array(
    'methods' => 'GET',
    'callback' => 'artly_handle_full_sync_progress_request',
    'permission_callback' => function () {
      $api_key = isset($_SERVER['HTTP_X_ARTLY_SECRET']) ? $_SERVER['HTTP_X_ARTLY_SECRET'] : '';
      $stored_secret = get_option(ARB_ENGINE_SECRET_OPTION);
      return !empty($api_key) && $api_key === $stored_secret;
    },
  ));
}

function artly_handle_sync_request(WP_REST_Request $request)
{
  // Simple Secret Key Security to bypass complex WP Auth issues
  $secret = $request->get_param('secret');
  if ($secret !== 'renewalflow_secure_sync_2024') { // Hardcoded secret for now
    return new WP_Error('rest_forbidden', 'Invalid Secret Key', array('status' => 401));
  }

  $page = $request->get_param('page') ? (int) $request->get_param('page') : 1;
  $limit = $request->get_param('limit') ? (int) $request->get_param('limit') : 50;
  $offset = ($page - 1) * $limit;
  $updated_after = $request->get_param('updated_after');

  $args = array(
    'number' => $limit,
    'offset' => $offset,
    'orderby' => 'ID',
    'order' => 'ASC',
    'fields' => array('ID', 'user_email', 'display_name'),
  );

  if (!empty($updated_after)) {
    global $wpdb;

    // Debug logging
    artly_reminder_bridge_log("Sync requested with updated_after: " . $updated_after);

    $timestamp = strtotime($updated_after);
    if (!$timestamp) {
      artly_reminder_bridge_log("Failed to parse updated_after date. Falling back to full sync.");
      // If we can't parse date, we might want to return everything or error?
      // Currently behavior matches "start from scratch", so valid.
      // But let's try to handle strict ISO if strtotime fails often (unlikely for ISO).
      // Fallback to empty to trigger full sync
    } else {
      $date_str = gmdate('Y-m-d H:i:s', $timestamp);
      $user_ids = array();

      // 1. Users created after date (user_registered is GMT)
      $new_users = get_users(array(
        'date_query' => array(array('after' => $date_str, 'inclusive' => true)),
        'fields' => 'ID',
      ));
      if (!empty($new_users)) {
        $user_ids = array_merge($user_ids, $new_users);
      }

      // 2. Users with orders modified after date (use GMT)
      // Check if post_modified_gmt exists/is populated (usually yes for orders)
      $order_users = $wpdb->get_col($wpdb->prepare(
        "SELECT DISTINCT pm.meta_value FROM {$wpdb->posts} p
        INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
        WHERE p.post_type = 'shop_order'
        AND p.post_modified_gmt > %s
        AND pm.meta_key = '_customer_user'
        AND pm.meta_value > 0",
        $date_str
      ));
      if (!empty($order_users)) {
        $user_ids = array_merge($user_ids, array_map('intval', $order_users));
      }

      // 3. Messages/Points Log after date
      if (class_exists('WC_Points_Rewards_Manager')) {
        $log_table = $wpdb->prefix . 'wc_points_rewards_user_points_log';
        // Check if valid table
        if ($wpdb->get_var("SHOW TABLES LIKE '$log_table'") == $log_table) {
          // Point log `date` is usually local/server time. 
          // We compare against GMT date string. 
          // This might be slightly off if server time != GMT, but it's acceptable for now 
          // as we prefer over-fetching to under-fetching.
          $points_users = $wpdb->get_col($wpdb->prepare(
            "SELECT DISTINCT user_id FROM {$log_table} WHERE date > %s",
            $date_str
          ));
          if (!empty($points_users)) {
            $user_ids = array_merge($user_ids, array_map('intval', $points_users));
          }
        }
      }

      $user_ids = array_unique($user_ids);

      if (empty($user_ids)) {
        // No changes found
        return new WP_REST_Response(array(
          'data' => array(),
          'meta' => array('page' => $page, 'limit' => $limit, 'total_users' => 0)
        ), 200);
      }

      $args['include'] = $user_ids;
    }
  }
  // Ideally we filter first then slice.

  // Get users (Subscribers + Customers)
  $users = get_users($args);

  $data = array();

  foreach ($users as $user) {
    // 1. Get Points Balance
    $points = 0;
    if (class_exists('WC_Points_Rewards_Manager')) {
      $points = WC_Points_Rewards_Manager::get_users_points($user->ID);
    } else {
      $points = (int) get_user_meta($user->ID, '_wc_points_balance', true);
    }

    // 2. Get Last Paid Order Date
    $last_order_date = null;
    $customer_orders = wc_get_orders(array(
      'limit' => 1,
      'customer' => $user->ID,
      'status' => array('processing', 'completed'),
      'orderby' => 'date',
      'order' => 'DESC',
    ));

    if (!empty($customer_orders)) {
      $order = $customer_orders[0];
      $last_order_date = $order->get_date_created()->date('c'); // ISO 8601
    }

    $data[] = array(
      'id' => $user->ID,
      'email' => $user->user_email,
      'name' => $user->display_name,
      'points' => $points,
      'last_order_date' => $last_order_date
    );
  }

  $total_users_count = count_users();

  return new WP_REST_Response(array(
    'data' => $data,
    'meta' => array(
      'page' => $page,
      'limit' => $limit,
      'total_users' => $total_users_count['total_users']
    )
  ), 200);
}

function artly_handle_full_sync_request(WP_REST_Request $request)
{
  // Verify API key
  $api_key = $request->get_header('x-artly-secret');
  $stored_secret = get_option(ARB_ENGINE_SECRET_OPTION);

  if (empty($api_key) || $api_key !== $stored_secret) {
    return new WP_Error('unauthorized', 'Invalid API key', array('status' => 401));
  }

  $step = $request->get_param('step');
  $start_time = current_time('mysql', true);

  // If no step specified, default to 'all' which runs everything (legacy/simple mode)
  // If step IS specified, we assume the orchestrator (Node backend) calls 'init' first to reset progress

  if ($step === 'init') {
    update_option(ARB_FULL_SYNC_PROGRESS_OPTION, array(
      'status' => 'running',
      'current_step' => 'users',
      'total_steps' => 3,
      'completed_steps' => 0,
      'overall_progress' => 0,
      'start_time' => $start_time,
      'end_time' => null,
      'users' => array('status' => 'pending', 'progress' => 0, 'total' => 0, 'processed' => 0, 'message' => ''),
      'points' => array('status' => 'pending', 'progress' => 0, 'total' => 0, 'processed' => 0, 'message' => ''),
      'charges' => array('status' => 'pending', 'progress' => 0, 'total' => 0, 'processed' => 0, 'message' => ''),
    ));
    return new WP_REST_Response(array('success' => true, 'message' => 'Full sync initialized'), 200);
  }

  // If not init, load existing progress or create new if missing
  $current_progress = get_option(ARB_FULL_SYNC_PROGRESS_OPTION, null);
  if (!$current_progress) {
    // Fallback for direct "all" calls without init
    $current_progress = array(
      'status' => 'running',
      'current_step' => 'users',
      'total_steps' => 3,
      'completed_steps' => 0,
      'overall_progress' => 0,
      'start_time' => $start_time,
      'users' => array('status' => 'pending'),
      'points' => array('status' => 'pending'),
      'charges' => array('status' => 'pending'),
    );
  }

  $results = array();

  // --- Step: Users ---
  if (!$step || $step === 'users') {
    try {
      artly_reminder_bridge_log('Starting full sync step: Users');
      $current_progress['current_step'] = 'users';
      $current_progress['users'] = array('status' => 'running', 'progress' => 0, 'total' => 0, 'processed' => 0, 'message' => 'Starting users sync...');
      update_option(ARB_FULL_SYNC_PROGRESS_OPTION, $current_progress);

      $results['users'] = artly_sync_users_from_woo();

      $user_progress = get_option(ARB_SYNC_PROGRESS_OPTION, array());

      $current_progress = get_option(ARB_FULL_SYNC_PROGRESS_OPTION, array()); // Reload in case parallel updates
      $current_progress['users'] = array(
        'status' => 'completed',
        'progress' => 100,
        'total' => $user_progress['total'] ?? 0,
        'processed' => $user_progress['processed'] ?? 0,
        'message' => $results['users']['message'] ?? 'Users sync completed'
      );
      // Only increment global counters if we are orchestrating stepwise
      if ($step === 'users') {
        $current_progress['completed_steps'] = max($current_progress['completed_steps'], 1);
        $current_progress['overall_progress'] = 33;
      }
      update_option(ARB_FULL_SYNC_PROGRESS_OPTION, $current_progress);
      artly_reminder_bridge_log('Full sync step: Users completed');
    } catch (Exception $e) {
      artly_reminder_bridge_log('Full sync step: Users error - ' . $e->getMessage());
      $results['users'] = array('success' => false, 'message' => $e->getMessage());
      $current_progress['users'] = array('status' => 'error', 'message' => $e->getMessage(), 'progress' => 0);
      update_option(ARB_FULL_SYNC_PROGRESS_OPTION, $current_progress);
      if ($step)
        return new WP_REST_Response($results, 500);
    }
  }

  // --- Step: Points ---
  if (!$step || $step === 'points') {
    try {
      artly_reminder_bridge_log('Starting full sync step: Points');
      $current_progress = get_option(ARB_FULL_SYNC_PROGRESS_OPTION, array());
      $current_progress['current_step'] = 'points';
      $current_progress['points'] = array('status' => 'running', 'progress' => 0, 'total' => 0, 'processed' => 0, 'message' => 'Starting points sync...');
      update_option(ARB_FULL_SYNC_PROGRESS_OPTION, $current_progress);

      $results['points'] = artly_sync_points_balances_from_woo();

      $points_progress = get_option(ARB_SYNC_PROGRESS_OPTION, array());

      $current_progress = get_option(ARB_FULL_SYNC_PROGRESS_OPTION, array());
      $current_progress['points'] = array(
        'status' => 'completed',
        'progress' => 100,
        'total' => $points_progress['total'] ?? 0,
        'processed' => $points_progress['processed'] ?? 0,
        'message' => $results['points']['message'] ?? 'Points sync completed'
      );
      if ($step === 'points') {
        $current_progress['completed_steps'] = max($current_progress['completed_steps'], 2);
        $current_progress['overall_progress'] = 66;
      }
      update_option(ARB_FULL_SYNC_PROGRESS_OPTION, $current_progress);
      artly_reminder_bridge_log('Full sync step: Points completed');
    } catch (Exception $e) {
      artly_reminder_bridge_log('Full sync step: Points error - ' . $e->getMessage());
      $results['points'] = array('success' => false, 'message' => $e->getMessage());
      $current_progress['points'] = array('status' => 'error', 'message' => $e->getMessage(), 'progress' => 0);
      update_option(ARB_FULL_SYNC_PROGRESS_OPTION, $current_progress);
      if ($step)
        return new WP_REST_Response($results, 500);
    }
  }

  // --- Step: Charges ---
  if (!$step || $step === 'charges') {
    try {
      artly_reminder_bridge_log('Starting full sync step: Charges');
      $current_progress = get_option(ARB_FULL_SYNC_PROGRESS_OPTION, array());
      $current_progress['current_step'] = 'charges';
      $current_progress['charges'] = array('status' => 'running', 'progress' => 0, 'total' => 0, 'processed' => 0, 'message' => 'Starting charges sync...');
      update_option(ARB_FULL_SYNC_PROGRESS_OPTION, $current_progress);

      $results['charges'] = artly_sync_charges_from_woo();

      $charges_progress = get_option(ARB_SYNC_PROGRESS_OPTION, array());

      $current_progress = get_option(ARB_FULL_SYNC_PROGRESS_OPTION, array());
      $current_progress['charges'] = array(
        'status' => 'completed',
        'progress' => 100,
        'total' => $charges_progress['total'] ?? 0,
        'processed' => $charges_progress['processed'] ?? 0,
        'message' => $results['charges']['message'] ?? 'Charges sync completed'
      );
      if ($step === 'charges') {
        $current_progress['completed_steps'] = 3;
        $current_progress['overall_progress'] = 100;
        // Mark as fully completed if this was the last step
        $current_progress['status'] = 'completed';
        $current_progress['current_step'] = 'completed';
        $current_progress['end_time'] = current_time('mysql', true);
      }
      update_option(ARB_FULL_SYNC_PROGRESS_OPTION, $current_progress);
      artly_reminder_bridge_log('Full sync step: Charges completed');
    } catch (Exception $e) {
      artly_reminder_bridge_log('Full sync step: Charges error - ' . $e->getMessage());
      $results['charges'] = array('success' => false, 'message' => $e->getMessage());
      $current_progress['charges'] = array('status' => 'error', 'message' => $e->getMessage(), 'progress' => 0);
      update_option(ARB_FULL_SYNC_PROGRESS_OPTION, $current_progress);
      if ($step)
        return new WP_REST_Response($results, 500);
    }
  }

  // Finalize (only if running all at once)
  if (!$step) {
    $current_progress = get_option(ARB_FULL_SYNC_PROGRESS_OPTION, array());
    $current_progress['status'] = 'completed';
    $current_progress['end_time'] = current_time('mysql', true);
    update_option(ARB_FULL_SYNC_PROGRESS_OPTION, $current_progress);
    artly_reminder_bridge_log('Full sync completed');
  }

  return new WP_REST_Response($results, 200);
}

function artly_handle_full_sync_progress_request(WP_REST_Request $request)
{
  $api_key = $request->get_header('x-artly-secret');
  $stored_secret = get_option(ARB_ENGINE_SECRET_OPTION);

  if (empty($api_key) || $api_key !== $stored_secret) {
    return new WP_Error('unauthorized', 'Invalid API key', array('status' => 401));
  }

  $progress = get_option(ARB_FULL_SYNC_PROGRESS_OPTION, null);

  if (!$progress) {
    return new WP_REST_Response(array('status' => 'idle'), 200);
  }

  // Calculate current step progress from individual sync progress
  $current_step = $progress['current_step'] ?? 'users';
  $individual_progress = get_option(ARB_SYNC_PROGRESS_OPTION, array());

  if ($current_step !== 'completed' && $current_step !== 'users' && $current_step !== 'points' && $current_step !== 'charges') {
    // Invalid step, return current progress
    return new WP_REST_Response($progress, 200);
  }

  if ($current_step !== 'completed' && isset($individual_progress['total']) && $individual_progress['total'] > 0) {
    $step_progress = round(($individual_progress['processed'] / $individual_progress['total']) * 100, 1);
    $progress[$current_step]['progress'] = $step_progress;
    $progress[$current_step]['total'] = $individual_progress['total'];
    $progress[$current_step]['processed'] = $individual_progress['processed'];
    $progress[$current_step]['message'] = $individual_progress['message'] ?? '';

    // Calculate overall progress: completed steps + current step progress
    $base_progress = ($progress['completed_steps'] / $progress['total_steps']) * 100;
    $current_step_weight = (1 / $progress['total_steps']) * 100;
    $progress['overall_progress'] = round($base_progress + (($step_progress / 100) * $current_step_weight), 1);
  }

  return new WP_REST_Response($progress, 200);
}

// --- End Custom Sync ---

// Check if user points table exists (for current balances)
function artly_reminder_bridge_user_points_table_exists(\wpdb $wpdb): bool
{
  $table_name = $wpdb->prefix . 'wc_points_rewards_user_points';
  return (bool) $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $table_name));
}

// Sync current points balances only (for initial sync)
function artly_sync_points_balances_from_woo(): array
{
  global $wpdb;

  if (!artly_reminder_bridge_points_table_exists($wpdb)) {
    $msg = 'Woo Points & Rewards table not found; skipping sync.';
    artly_reminder_bridge_log($msg);
    update_option(ARB_LAST_SYNC_RESULT, array('type' => 'points', 'success' => false, 'message' => $msg, 'count' => 0));
    return array('success' => false, 'message' => $msg, 'count' => 0);
  }

  $balances = array();

  // Try to get balances from user_points table first (if exists)
  if (artly_reminder_bridge_user_points_table_exists($wpdb)) {
    $table_name = $wpdb->prefix . 'wc_points_rewards_user_points';
    $users = $wpdb->get_results("SELECT user_id, points_balance FROM {$table_name}");

    foreach ($users as $user_row) {
      $user = get_userdata((int) $user_row->user_id);
      if ($user && !empty($user->user_email)) {
        $balances[] = array(
          'wp_user_id' => (int) $user_row->user_id,
          'email' => $user->user_email,
          'points_balance' => (int) $user_row->points_balance,
        );
      }
    }
  } else {
    // Calculate balances from logs
    $log_table = $wpdb->prefix . 'wc_points_rewards_user_points_log';
    $query = "SELECT user_id, SUM(points) as balance FROM {$log_table} GROUP BY user_id";
    $results = $wpdb->get_results($query);

    foreach ($results as $row) {
      $user = get_userdata((int) $row->user_id);
      if ($user && !empty($user->user_email)) {
        $balances[] = array(
          'wp_user_id' => (int) $row->user_id,
          'email' => $user->user_email,
          'points_balance' => (int) $row->balance,
        );
      }
    }
  }

  if (empty($balances)) {
    $msg = 'No points balances found to sync.';
    update_option(ARB_LAST_SYNC_RESULT, array('type' => 'points', 'success' => true, 'message' => $msg, 'count' => 0));
    update_option(ARB_SYNC_PROGRESS_OPTION, array(
      'type' => 'points',
      'status' => 'completed',
      'processed' => 0,
      'total' => 0,
      'imported' => 0,
      'message' => $msg,
    ));
    return array('success' => true, 'message' => $msg, 'count' => 0);
  }

  $total_users = count($balances);

  // Initialize progress tracking
  update_option(ARB_SYNC_PROGRESS_OPTION, array(
    'type' => 'points',
    'status' => 'running',
    'processed' => 0,
    'total' => $total_users,
    'imported' => 0,
    'message' => sprintf('Starting balance sync for %d users...', $total_users),
  ));

  // Optimized batch size for faster syncing (Plan 1: Quick Wins)
  // Increased from 50 to 500 for 10x speedup
  $batch_size = 500;
  $total_updated = 0;
  $total_processed = 0;
  $batches = array_chunk($balances, $batch_size);
  $total_batches = count($batches);

  foreach ($batches as $batch_num => $batch) {
    // Check for cancel flag before each batch
    // Force cache clear to ensure we read fresh value from DB (since update happens in another request)
    wp_cache_delete(ARB_SYNC_CANCEL_FLAG, 'options');
    if (get_option(ARB_SYNC_CANCEL_FLAG, false)) {
      $msg = sprintf('Sync cancelled by user. Processed %d of %d batches.', $batch_num, $total_batches);
      update_option(ARB_LAST_SYNC_RESULT, array('type' => 'points', 'success' => false, 'message' => $msg, 'count' => $total_updated));
      update_option(ARB_SYNC_PROGRESS_OPTION, array(
        'type' => 'points',
        'status' => 'cancelled',
        'processed' => $total_processed,
        'total' => $total_users,
        'imported' => $total_updated,
        'message' => $msg,
      ));
      delete_option(ARB_SYNC_CANCEL_FLAG);
      return array('success' => false, 'message' => $msg, 'count' => $total_updated);
    }

    // Update progress before processing batch
    update_option(ARB_SYNC_PROGRESS_OPTION, array(
      'type' => 'points',
      'status' => 'running',
      'processed' => $total_processed,
      'total' => $total_users,
      'imported' => $total_updated,
      'message' => sprintf('Processing batch %d of %d (%d users processed)...', $batch_num + 1, $total_batches, $total_processed),
    ));

    $result = artly_reminder_bridge_post_balances($batch);
    if (null === $result) {
      $error = get_option(ARB_LAST_SYNC_ERROR, 'Unknown error during points balance sync');
      update_option(ARB_LAST_SYNC_RESULT, array('type' => 'points', 'success' => false, 'message' => $error, 'count' => $total_updated));
      update_option(ARB_SYNC_PROGRESS_OPTION, array(
        'type' => 'points',
        'status' => 'error',
        'processed' => $total_processed,
        'total' => $total_users,
        'imported' => $total_updated,
        'message' => $error,
      ));
      return array('success' => false, 'message' => $error, 'count' => $total_updated);
    }

    $batch_updated = (int) ($result['updated'] ?? count($batch));
    $total_updated += $batch_updated;
    $total_processed += count($batch);

    // Update progress after processing batch
    update_option(ARB_SYNC_PROGRESS_OPTION, array(
      'type' => 'points',
      'status' => 'running',
      'processed' => $total_processed,
      'total' => $total_users,
      'imported' => $total_updated,
      'message' => sprintf('Processed batch %d of %d: %d balances updated', $batch_num + 1, $total_batches, $batch_updated),
    ));
  }

  // Clear cancel flag on successful completion
  delete_option(ARB_SYNC_CANCEL_FLAG);

  $msg = sprintf('Successfully synced %d points balances', $total_updated);
  artly_reminder_bridge_log($msg);
  update_option(ARB_LAST_SYNC_RESULT, array('type' => 'points', 'success' => true, 'message' => $msg, 'count' => $total_updated));
  update_option(ARB_LAST_SYNC_TIME_OPTION, current_time('mysql', true));

  // Final progress update
  update_option(ARB_SYNC_PROGRESS_OPTION, array(
    'type' => 'points',
    'status' => 'completed',
    'processed' => $total_processed,
    'total' => $total_users,
    'imported' => $total_updated,
    'message' => $msg,
  ));

  return array('success' => true, 'message' => $msg, 'count' => $total_updated);
}

// Sync incremental changes (new logs since last check) - for hourly cron
function artly_sync_points_changes_from_woo(): array
{
  global $wpdb;

  if (!artly_reminder_bridge_points_table_exists($wpdb)) {
    $msg = 'Woo Points & Rewards table not found; skipping sync.';
    artly_reminder_bridge_log($msg);
    return array('success' => false, 'message' => $msg, 'count' => 0);
  }

  $last_id = (int) get_option(ARB_LAST_LOG_ID_OPTION, 0);
  $total_imported = 0;
  $batch_number = 0;

  while (true) {
    $rows = artly_reminder_bridge_fetch_events_batch($wpdb, $last_id);

    if (empty($rows)) {
      break;
    }

    $batch_number++;
    $payload = array();

    foreach ($rows as $row) {
      $item = artly_reminder_bridge_build_payload_item($row);
      if ($item) {
        $payload[] = $item;
      }
    }

    if (empty($payload)) {
      $last_id = (int) end($rows)->id;
      update_option(ARB_LAST_LOG_ID_OPTION, $last_id);
      continue;
    }

    $result = artly_reminder_bridge_post_changes($payload);
    if (null === $result) {
      $error = get_option(ARB_LAST_SYNC_ERROR, 'Unknown error during points sync');
      artly_reminder_bridge_log('Hourly sync error: ' . $error);
      return array('success' => false, 'message' => $error, 'count' => $total_imported);
    }

    $last_id = (int) end($rows)->id;
    update_option(ARB_LAST_LOG_ID_OPTION, $last_id);
    $batch_imported = (int) ($result['imported'] ?? count($payload));
    $total_imported += $batch_imported;
  }

  if ($total_imported > 0) {
    $msg = sprintf('Hourly sync: synced %d new points events (up to ID %d)', $total_imported, $last_id);
    artly_reminder_bridge_log($msg);
    update_option(ARB_LAST_SYNC_TIME_OPTION, current_time('mysql', true));
    return array('success' => true, 'message' => $msg, 'count' => $total_imported);
  }

  return array('success' => true, 'message' => 'No new points events to sync.', 'count' => 0);
}

function artly_sync_points_from_woo(): array
{
  global $wpdb;

  if (!artly_reminder_bridge_points_table_exists($wpdb)) {
    $msg = 'Woo Points & Rewards table not found; skipping sync.';
    artly_reminder_bridge_log($msg);
    update_option(ARB_LAST_SYNC_RESULT, array('type' => 'points', 'success' => false, 'message' => $msg, 'count' => 0));
    delete_option(ARB_SYNC_PROGRESS_OPTION);
    return array('success' => false, 'message' => $msg, 'count' => 0);
  }

  // Count total events to sync for progress tracking
  $total_count_query = $wpdb->prepare(
    "SELECT COUNT(*) FROM {$wpdb->prefix}wc_points_rewards_user_points_log WHERE id > %d",
    (int) get_option(ARB_LAST_LOG_ID_OPTION, 0)
  );
  $total_to_sync = (int) $wpdb->get_var($total_count_query);

  // Initialize progress
  update_option(ARB_SYNC_PROGRESS_OPTION, array(
    'type' => 'points',
    'status' => 'running',
    'processed' => 0,
    'total' => $total_to_sync,
    'imported' => 0,
    'message' => 'Starting sync...',
  ));

  $last_id = (int) get_option(ARB_LAST_LOG_ID_OPTION, 0);
  $total_imported = 0;
  $total_processed = 0;
  $batch_number = 0;

  while (true) {
    $rows = artly_reminder_bridge_fetch_events_batch($wpdb, $last_id);

    if (empty($rows)) {
      break;
    }

    $batch_number++;
    $payload = array();

    foreach ($rows as $row) {
      $item = artly_reminder_bridge_build_payload_item($row);
      if ($item) {
        $payload[] = $item;
      }
    }

    if (empty($payload)) {
      $last_id = (int) end($rows)->id;
      update_option(ARB_LAST_LOG_ID_OPTION, $last_id);
      // Update progress
      update_option(ARB_SYNC_PROGRESS_OPTION, array(
        'type' => 'points',
        'status' => 'running',
        'processed' => $total_processed,
        'total' => $total_to_sync,
        'imported' => $total_imported,
        'message' => sprintf('Processing batch %d...', $batch_number),
      ));
      continue;
    }

    // Update progress before sending batch
    update_option(ARB_SYNC_PROGRESS_OPTION, array(
      'type' => 'points',
      'status' => 'running',
      'processed' => $total_processed,
      'total' => $total_to_sync,
      'imported' => $total_imported,
      'message' => sprintf('Sending batch %d (%d events)...', $batch_number, count($payload)),
    ));

    $result = artly_reminder_bridge_post_events($payload);
    if (null === $result) {
      $error = get_option(ARB_LAST_SYNC_ERROR, 'Unknown error during points sync');
      update_option(ARB_LAST_SYNC_RESULT, array('type' => 'points', 'success' => false, 'message' => $error, 'count' => $total_imported));
      update_option(ARB_SYNC_PROGRESS_OPTION, array(
        'type' => 'points',
        'status' => 'error',
        'processed' => $total_processed,
        'total' => $total_to_sync,
        'imported' => $total_imported,
        'message' => $error,
      ));
      return array('success' => false, 'message' => $error, 'count' => $total_imported);
    }

    $last_id = (int) end($rows)->id;
    update_option(ARB_LAST_LOG_ID_OPTION, $last_id);
    update_option(ARB_LAST_SYNC_TIME_OPTION, current_time('mysql', true));
    $batch_imported = (int) ($result['imported'] ?? count($payload));
    $total_imported += $batch_imported;
    $total_processed += count($payload);

    // Update progress after batch
    update_option(ARB_SYNC_PROGRESS_OPTION, array(
      'type' => 'points',
      'status' => 'running',
      'processed' => $total_processed,
      'total' => $total_to_sync,
      'imported' => $total_imported,
      'message' => sprintf('Processed batch %d: %d imported', $batch_number, $batch_imported),
    ));
  }

  // Final progress update
  if ($total_imported > 0) {
    $msg = sprintf('Successfully synced %d points events (up to ID %d)', $total_imported, $last_id);
    artly_reminder_bridge_log($msg);
    update_option(ARB_LAST_SYNC_RESULT, array('type' => 'points', 'success' => true, 'message' => $msg, 'count' => $total_imported, 'total' => $total_processed));
    update_option(ARB_SYNC_PROGRESS_OPTION, array(
      'type' => 'points',
      'status' => 'completed',
      'processed' => $total_processed,
      'total' => $total_to_sync,
      'imported' => $total_imported,
      'message' => $msg,
    ));
    return array('success' => true, 'message' => $msg, 'count' => $total_imported, 'total' => $total_processed);
  }

  $msg = 'No new points events to sync.';
  update_option(ARB_LAST_SYNC_RESULT, array('type' => 'points', 'success' => true, 'message' => $msg, 'count' => 0));
  update_option(ARB_SYNC_PROGRESS_OPTION, array(
    'type' => 'points',
    'status' => 'completed',
    'processed' => 0,
    'total' => 0,
    'imported' => 0,
    'message' => $msg,
  ));
  return array('success' => true, 'message' => $msg, 'count' => 0);
}

function artly_sync_users_from_woo(): array
{
  // Clear any previous cancel flag
  delete_option(ARB_SYNC_CANCEL_FLAG);

  // First, count total users to determine batch size
  $total_user_count = count_users();
  $total_users = (int) $total_user_count['total_users'];

  artly_reminder_bridge_log(sprintf('Starting user sync. Total users: %d', $total_users));

  if ($total_users === 0) {
    $msg = 'No users to sync.';
    artly_reminder_bridge_log($msg);
    update_option(ARB_LAST_SYNC_RESULT, array('type' => 'users', 'success' => false, 'message' => $msg, 'count' => 0));
    return array('success' => false, 'message' => $msg, 'count' => 0);
  }

  // Initialize progress
  update_option(ARB_SYNC_PROGRESS_OPTION, array(
    'type' => 'users',
    'status' => 'running',
    'total' => $total_users,
    'processed' => 0,
    'imported' => 0,
    'message' => sprintf('Starting sync of %d users...', $total_users),
    'start_time' => current_time('mysql', true),
    'end_time' => null,
  ));

  // Optimized batch size for faster syncing (Plan 1: Quick Wins)
  // Increased from 10 to 100 for 10x speedup
  $batch_size = 100;

  artly_reminder_bridge_log(sprintf('Using batch size: %d (total users: %d)', $batch_size, $total_users));

  $offset = 0;
  $total_upserted = 0;
  $total_processed = 0;
  $batch_number = 0;

  while (true) {
    // Check for cancellation
    // Force cache clear to ensure we read fresh value from DB
    wp_cache_delete(ARB_SYNC_CANCEL_FLAG, 'options');
    if (get_option(ARB_SYNC_CANCEL_FLAG, false)) {
      update_option(ARB_SYNC_PROGRESS_OPTION, array(
        'type' => 'users',
        'status' => 'cancelled',
        'total' => $total_users,
        'processed' => $total_processed,
        'imported' => $total_upserted,
        'message' => 'Sync cancelled by user.',
        'start_time' => get_option(ARB_SYNC_PROGRESS_OPTION)['start_time'] ?? current_time('mysql', true),
        'end_time' => current_time('mysql', true),
      ));
      delete_option(ARB_SYNC_CANCEL_FLAG);
      return array('success' => false, 'message' => 'Sync cancelled by user.', 'count' => $total_upserted);
    }

    $batch_number++;

    // Fetch users in batches
    $users = get_users(array(
      'fields' => array('ID', 'user_email'),
      'number' => $batch_size,
      'offset' => $offset,
    ));

    if (empty($users)) {
      break; // No more users
    }

    $payload = array();

    foreach ($users as $user) {
      $user_meta = get_user_meta($user->ID);
      $payload[] = array(
        'wp_user_id' => (int) $user->ID,
        'email' => $user->user_email, // WordPress user email (not billing email)
        'phone' => isset($user_meta['billing_phone'][0]) ? $user_meta['billing_phone'][0] : null,
        'whatsapp' => isset($user_meta['whatsapp'][0]) ? $user_meta['whatsapp'][0] : null,
        'locale' => get_user_locale($user->ID),
        'timezone' => get_user_meta($user->ID, 'timezone_string', true) ?: null,
      );
    }

    if (empty($payload)) {
      $offset += $batch_size;
      continue;
    }

    // Update progress before sending batch
    $progress = $total_users > 0 ? round(($total_processed / $total_users) * 100, 1) : 0;
    update_option(ARB_SYNC_PROGRESS_OPTION, array(
      'type' => 'users',
      'status' => 'running',
      'total' => $total_users,
      'processed' => $total_processed,
      'imported' => $total_upserted,
      'message' => sprintf('Processing batch %d of %d (%d users processed)...', $batch_number, ceil($total_users / $batch_size), $total_processed),
      'start_time' => get_option(ARB_SYNC_PROGRESS_OPTION)['start_time'] ?? current_time('mysql', true),
      'end_time' => null,
    ));

    artly_reminder_bridge_log(sprintf(
      'Processing batch %d: %d users (Progress: %d/%d, %.1f%%)',
      $batch_number,
      count($payload),
      $total_processed,
      $total_users,
      $progress
    ));

    $result = artly_reminder_bridge_post_to_api('artly/sync/users', $payload);
    if (null === $result) {
      $error = get_option(ARB_LAST_SYNC_ERROR, 'Unknown error');
      $msg = sprintf('Failed to sync users batch %d (offset %d, %d users). %s', $batch_number, $offset, count($payload), $error);
      artly_reminder_bridge_log($msg);
      update_option(ARB_SYNC_PROGRESS_OPTION, array(
        'type' => 'users',
        'status' => 'error',
        'total' => $total_users,
        'processed' => $total_processed,
        'imported' => $total_upserted,
        'message' => sprintf('Error: %s', $error),
        'start_time' => get_option(ARB_SYNC_PROGRESS_OPTION)['start_time'] ?? current_time('mysql', true),
        'end_time' => current_time('mysql', true),
      ));
      update_option(ARB_LAST_SYNC_RESULT, array(
        'type' => 'users',
        'success' => false,
        'message' => $msg,
        'count' => $total_upserted,
        'total' => $total_processed,
        'progress' => $progress
      ));
      return array('success' => false, 'message' => $msg, 'count' => $total_upserted, 'total' => $total_processed);
    }

    $batch_upserted = (int) ($result['upserted'] ?? count($payload));
    $total_upserted += $batch_upserted;
    $total_processed += count($payload);

    artly_reminder_bridge_log(sprintf(
      'Batch %d completed: %d users synced (Total: %d/%d, %.1f%%)',
      $batch_number,
      $batch_upserted,
      $total_processed,
      $total_users,
      round(($total_processed / $total_users) * 100, 1)
    ));

    $offset += $batch_size;

    // If we got fewer users than the batch size, we're done
    if (count($users) < $batch_size) {
      break;
    }

    // Add a small delay between batches to prevent overwhelming the server
    // Only delay if we have more batches to process
    if ($offset < $total_users) {
      usleep(500000); // 0.5 second delay between batches
    }
  }

  // Finalize progress
  if ($total_upserted > 0) {
    $msg = sprintf('Successfully synced %d of %d users', $total_upserted, $total_users);
    artly_reminder_bridge_log($msg);
    update_option(ARB_SYNC_PROGRESS_OPTION, array(
      'type' => 'users',
      'status' => 'completed',
      'total' => $total_users,
      'processed' => $total_processed,
      'imported' => $total_upserted,
      'message' => $msg,
      'start_time' => get_option(ARB_SYNC_PROGRESS_OPTION)['start_time'] ?? current_time('mysql', true),
      'end_time' => current_time('mysql', true),
    ));
    update_option(ARB_LAST_SYNC_RESULT, array(
      'type' => 'users',
      'success' => true,
      'message' => $msg,
      'count' => $total_upserted,
      'total' => $total_users,
      'batches' => $batch_number
    ));
    return array('success' => true, 'message' => $msg, 'count' => $total_upserted, 'total' => $total_users, 'batches' => $batch_number);
  }

  $msg = 'No users were synced.';
  artly_reminder_bridge_log($msg);
  update_option(ARB_SYNC_PROGRESS_OPTION, array(
    'type' => 'users',
    'status' => 'completed',
    'total' => $total_users,
    'processed' => $total_processed,
    'imported' => 0,
    'message' => $msg,
    'start_time' => get_option(ARB_SYNC_PROGRESS_OPTION)['start_time'] ?? current_time('mysql', true),
    'end_time' => current_time('mysql', true),
  ));
  update_option(ARB_LAST_SYNC_RESULT, array('type' => 'users', 'success' => false, 'message' => $msg, 'count' => 0));
  return array('success' => false, 'message' => $msg, 'count' => 0);
}

function artly_sync_charges_from_woo(): array
{
  if (!class_exists('WooCommerce')) {
    $msg = 'WooCommerce not found; skipping charge sync.';
    artly_reminder_bridge_log($msg);
    update_option(ARB_LAST_SYNC_RESULT, array('type' => 'charges', 'success' => false, 'message' => $msg, 'count' => 0));
    return array('success' => false, 'message' => $msg, 'count' => 0);
  }

  // Clear any previous cancel flag
  delete_option(ARB_SYNC_CANCEL_FLAG);

  // Initialize progress
  update_option(ARB_SYNC_PROGRESS_OPTION, array(
    'type' => 'charges',
    'status' => 'running',
    'total' => 0,
    'processed' => 0,
    'imported' => 0,
    'message' => 'Fetching orders from WooCommerce...',
    'start_time' => current_time('mysql', true),
    'end_time' => null,
  ));

  // Get all orders (no limit, we'll process in batches)
  $orders = wc_get_orders(
    array(
      'limit' => -1, // Get all orders
      'status' => array('processing', 'completed', 'on-hold'),
      'orderby' => 'date',
      'order' => 'DESC',
      'return' => 'ids', // Get only IDs for better performance
    )
  );

  if (empty($orders)) {
    $msg = 'No orders found to sync.';
    artly_reminder_bridge_log($msg);
    update_option(ARB_SYNC_PROGRESS_OPTION, array(
      'type' => 'charges',
      'status' => 'completed',
      'total' => 0,
      'processed' => 0,
      'imported' => 0,
      'message' => $msg,
      'start_time' => current_time('mysql', true),
      'end_time' => current_time('mysql', true),
    ));
    update_option(ARB_LAST_SYNC_RESULT, array('type' => 'charges', 'success' => true, 'message' => $msg, 'count' => 0));
    return array('success' => true, 'message' => $msg, 'count' => 0);
  }

  $total_orders = count($orders);
  $total_upserted = 0;
  // Optimized batch size for faster syncing (Plan 1: Quick Wins)
  // Increased from 50 to 200 for 4x speedup
  $batch_size = 200;

  // Update progress with total
  update_option(ARB_SYNC_PROGRESS_OPTION, array(
    'type' => 'charges',
    'status' => 'running',
    'total' => $total_orders,
    'processed' => 0,
    'imported' => 0,
    'message' => sprintf('Processing %d orders...', $total_orders),
    'start_time' => current_time('mysql', true),
    'end_time' => null,
  ));

  // Process orders in batches
  $batches = array_chunk($orders, $batch_size);
  $batch_number = 0;

  foreach ($batches as $batch) {
    // Check for cancellation
    // Force cache clear to ensure we read fresh value from DB
    wp_cache_delete(ARB_SYNC_CANCEL_FLAG, 'options');
    if (get_option(ARB_SYNC_CANCEL_FLAG, false)) {
      update_option(ARB_SYNC_PROGRESS_OPTION, array(
        'type' => 'charges',
        'status' => 'cancelled',
        'total' => $total_orders,
        'processed' => $total_upserted,
        'imported' => $total_upserted,
        'message' => 'Sync cancelled by user.',
        'start_time' => get_option(ARB_SYNC_PROGRESS_OPTION)['start_time'] ?? current_time('mysql', true),
        'end_time' => current_time('mysql', true),
      ));
      delete_option(ARB_SYNC_CANCEL_FLAG);
      return array('success' => false, 'message' => 'Sync cancelled by user.', 'count' => $total_upserted);
    }

    $batch_number++;
    $payload = array();

    foreach ($batch as $order_id) {
      $order = wc_get_order($order_id);
      if (!$order) {
        continue;
      }

      $user_id = $order->get_user_id();
      if (!$user_id) {
        continue;
      }

      // Get email: prefer WordPress user email, fallback to billing email
      $billing_email = $order->get_billing_email();
      $user = get_userdata($user_id);
      $email = ($user && !empty($user->user_email)) ? $user->user_email : $billing_email;

      // If billing email differs from user email, log it for debugging
      if ($user && !empty($user->user_email) && $billing_email !== $user->user_email) {
        artly_reminder_bridge_log(sprintf(
          'Order #%d: Billing email (%s) differs from user email (%s) for user ID %d',
          $order_id,
          $billing_email,
          $user->user_email,
          $user_id
        ));
      }

      $date_created = $order->get_date_created();
      $created_at = $date_created ? gmdate('c', $date_created->getTimestamp()) : gmdate('c');

      $payload[] = array(
        'external_charge_id' => (string) $order->get_id(),
        'wp_user_id' => $user_id > 0 ? $user_id : null,
        'email' => $email, // Use WordPress user email if available
        'order_id' => (string) $order->get_id(),
        'amount' => (float) $order->get_total(),
        'currency' => $order->get_currency(),
        'status' => $order->get_status(),
        'payment_method' => $order->get_payment_method(),
        'created_at' => $created_at,
      );
    }

    if (empty($payload)) {
      continue;
    }

    // Send batch to API
    $result = artly_reminder_bridge_post_to_api('artly/sync/charges', $payload);

    if (null === $result) {
      $error = get_option(ARB_LAST_SYNC_ERROR, 'Unknown error during charge sync');
      update_option(ARB_SYNC_PROGRESS_OPTION, array(
        'type' => 'charges',
        'status' => 'error',
        'total' => $total_orders,
        'processed' => $total_upserted,
        'imported' => $total_upserted,
        'message' => sprintf('Error: %s', $error),
        'start_time' => get_option(ARB_SYNC_PROGRESS_OPTION)['start_time'] ?? current_time('mysql', true),
        'end_time' => current_time('mysql', true),
      ));
      update_option(ARB_LAST_SYNC_RESULT, array('type' => 'charges', 'success' => false, 'message' => $error, 'count' => $total_upserted));
      return array('success' => false, 'message' => $error, 'count' => $total_upserted);
    }

    $batch_upserted = (int) ($result['upserted'] ?? count($payload));
    $total_upserted += $batch_upserted;

    // Update progress
    update_option(ARB_SYNC_PROGRESS_OPTION, array(
      'type' => 'charges',
      'status' => 'running',
      'total' => $total_orders,
      'processed' => $total_upserted,
      'imported' => $total_upserted,
      'message' => sprintf('Processing batch %d/%d: %d/%d orders synced...', $batch_number, count($batches), $total_upserted, $total_orders),
      'start_time' => get_option(ARB_SYNC_PROGRESS_OPTION)['start_time'] ?? current_time('mysql', true),
      'end_time' => null,
    ));
  }

  // Finalize progress
  $msg = sprintf('Successfully synced %d charges', $total_upserted);
  artly_reminder_bridge_log($msg);
  update_option(ARB_SYNC_PROGRESS_OPTION, array(
    'type' => 'charges',
    'status' => 'completed',
    'total' => $total_orders,
    'processed' => $total_upserted,
    'imported' => $total_upserted,
    'message' => $msg,
    'start_time' => get_option(ARB_SYNC_PROGRESS_OPTION)['start_time'] ?? current_time('mysql', true),
    'end_time' => current_time('mysql', true),
  ));
  update_option(ARB_LAST_SYNC_RESULT, array('type' => 'charges', 'success' => true, 'message' => $msg, 'count' => $total_upserted, 'total' => $total_orders));
  update_option(ARB_LAST_SYNC_TIME_OPTION, current_time('mysql', true));

  return array('success' => true, 'message' => $msg, 'count' => $total_upserted, 'total' => $total_orders);
}

add_action('admin_menu', 'artly_reminder_bridge_admin_menu');
add_action('wp_ajax_artly_get_sync_progress', 'artly_get_sync_progress');
function artly_get_sync_progress()
{
  check_ajax_referer('artly_sync_progress', '_wpnonce');
  $progress = get_option(ARB_SYNC_PROGRESS_OPTION, null);
  if ($progress) {
    // If progress is completed or error, clear it after returning (one-time return)
    if (isset($progress['status']) && ($progress['status'] === 'completed' || $progress['status'] === 'error' || $progress['status'] === 'cancelled')) {
      // Check if this is the first time we're returning completed status
      // We'll clear it after a short delay to allow the UI to show the result
      $progress['_should_clear'] = true;
    }
    wp_send_json_success($progress);
  } else {
    wp_send_json_success(array('status' => 'idle'));
  }
}

add_action('wp_ajax_artly_clear_sync_progress', 'artly_clear_sync_progress');
function artly_clear_sync_progress()
{
  check_ajax_referer('artly_sync_progress', '_wpnonce');
  delete_option(ARB_SYNC_PROGRESS_OPTION);
  wp_send_json_success(array('message' => 'Progress cleared.'));
}

add_action('wp_ajax_artly_cancel_sync', 'artly_cancel_sync');
function artly_cancel_sync()
{
  check_ajax_referer('artly_sync_points', '_wpnonce');

  // Legacy: set cancel flag for old sync method
  update_option(ARB_SYNC_CANCEL_FLAG, true);

  // If jobId is provided, cancel via API
  $job_id = isset($_POST['jobId']) ? sanitize_text_field($_POST['jobId']) : '';

  if (!empty($job_id)) {
    $api_url = get_option(ARB_ENGINE_URL_OPTION);
    $api_secret = get_option(ARB_ENGINE_SECRET_OPTION);

    if (!empty($api_url) && !empty($api_secret)) {
      $url = rtrim($api_url, '/') . '/artly/sync/points-balances/cancel';

      $response = wp_remote_post($url, array(
        'headers' => array(
          'x-artly-secret' => $api_secret,
          'Content-Type' => 'application/json',
        ),
        'body' => json_encode(array('jobId' => $job_id)),
        'timeout' => 30,
      ));

      if (!is_wp_error($response)) {
        $code = wp_remote_retrieve_response_code($response);
        if ($code < 300) {
          wp_send_json_success(array('message' => 'Sync cancellation requested.'));
          return;
        }
      }
    }
  }

  wp_send_json_success(array('message' => 'Sync cancellation requested.'));
}

add_action('wp_ajax_artly_start_sync_points', 'artly_start_sync_points');
function artly_start_sync_points()
{
  check_ajax_referer('artly_sync_points', '_wpnonce');

  global $wpdb;

  // Clear any previous progress
  delete_option(ARB_SYNC_PROGRESS_OPTION);

  if (!artly_reminder_bridge_points_table_exists($wpdb)) {
    wp_send_json_error(array('message' => 'Woo Points & Rewards table not found'));
    return;
  }

  // Collect all balances
  $balances = array();

  if (artly_reminder_bridge_user_points_table_exists($wpdb)) {
    $table_name = $wpdb->prefix . 'wc_points_rewards_user_points';
    $users = $wpdb->get_results("SELECT user_id, points_balance FROM {$table_name}");

    foreach ($users as $user_row) {
      $user = get_userdata((int) $user_row->user_id);
      if ($user && !empty($user->user_email)) {
        $balances[] = array(
          'wp_user_id' => (int) $user_row->user_id,
          'email' => $user->user_email,
          'points_balance' => (int) $user_row->points_balance,
        );
      }
    }
  } else {
    $log_table = $wpdb->prefix . 'wc_points_rewards_user_points_log';
    $query = "SELECT user_id, SUM(points) as balance FROM {$log_table} GROUP BY user_id";
    $results = $wpdb->get_results($query);

    foreach ($results as $row) {
      $user = get_userdata((int) $row->user_id);
      if ($user && !empty($user->user_email)) {
        $balances[] = array(
          'wp_user_id' => (int) $row->user_id,
          'email' => $user->user_email,
          'points_balance' => (int) $row->balance,
        );
      }
    }
  }

  if (empty($balances)) {
    wp_send_json_error(array('message' => 'No points balances found to sync'));
    return;
  }

  // Try new job-based API endpoint first
  $result = artly_reminder_bridge_start_balance_sync($balances);

  // If new endpoint fails (404 or 401), fall back to legacy endpoint
  if (null === $result || !isset($result['jobId'])) {
    $last_error = get_option(ARB_LAST_SYNC_ERROR, '');

    // Check if it's a 404 (endpoint not found) or 401 (auth issue)
    $is_404 = strpos($last_error, '404') !== false || strpos($last_error, 'not found') !== false;
    $is_401 = strpos($last_error, '401') !== false || strpos($last_error, 'Unauthorized') !== false;

    if ($is_404) {
      // New endpoint doesn't exist yet, fall back to legacy sync
      artly_reminder_bridge_log('New job-based endpoint not available, falling back to legacy sync');
      $legacy_result = artly_sync_points_balances_from_woo();

      if ($legacy_result['success']) {
        wp_send_json_success(array(
          'message' => $legacy_result['message'],
          'count' => $legacy_result['count'],
          'legacy' => true, // Indicate this used legacy endpoint
        ));
      } else {
        wp_send_json_error(array('message' => $legacy_result['message']));
      }
      return;
    } else if ($is_401) {
      // Authentication failed - return the error
      wp_send_json_error(array('message' => $last_error));
      return;
    } else {
      // Other error
      $error = $last_error ?: 'Failed to start sync job';
      wp_send_json_error(array('message' => $error));
      return;
    }
  }

  // Return jobId to frontend
  wp_send_json_success(array(
    'jobId' => $result['jobId'],
    'total' => count($balances),
    'message' => 'Sync job started',
  ));
}

add_action('wp_ajax_artly_get_sync_job_status', 'artly_get_sync_job_status');
function artly_get_sync_job_status()
{
  check_ajax_referer('artly_sync_points', '_wpnonce');

  $job_id = isset($_POST['jobId']) ? sanitize_text_field($_POST['jobId']) : '';

  if (empty($job_id)) {
    wp_send_json_error(array('message' => 'jobId is required'));
    return;
  }

  $status = artly_reminder_bridge_get_sync_status($job_id);

  if (null === $status) {
    wp_send_json_error(array('message' => 'Failed to get sync status'));
    return;
  }

  if (isset($status['success']) && $status['success'] && isset($status['job'])) {
    // Map backend job status to frontend progress format
    $job = $status['job'];
    wp_send_json_success(array(
      'status' => $job['status'],
      'processed' => $job['processed'],
      'total' => $job['total'],
      'imported' => $job['result']['count'] ?? $job['processed'],
      'message' => $job['stepMessage'],
      'progress' => $job['progress'],
      'error' => $job['error'] ?? null,
      'result' => $job['result'] ?? null,
    ));
  } else {
    wp_send_json_error(array('message' => $status['error'] ?? 'Unknown error'));
  }
}

add_action('wp_ajax_artly_start_sync_users', 'artly_start_sync_users');
function artly_start_sync_users()
{
  check_ajax_referer('artly_sync_users', '_wpnonce');

  // Clear any previous progress
  delete_option(ARB_SYNC_PROGRESS_OPTION);

  $result = artly_sync_users_from_woo();
  wp_send_json_success($result);
}

add_action('wp_ajax_artly_get_users_count', 'artly_get_users_count');
function artly_get_users_count()
{
  check_ajax_referer('artly_sync_users', '_wpnonce');

  $total_user_count = count_users();
  $total_users = (int) $total_user_count['total_users'];

  wp_send_json_success(array('total' => $total_users));
}

add_action('wp_ajax_artly_start_sync_charges', 'artly_start_sync_charges');
function artly_start_sync_charges()
{
  check_ajax_referer('artly_sync_charges', '_wpnonce');

  // Clear any previous progress
  delete_option(ARB_SYNC_PROGRESS_OPTION);

  // Run charges sync
  $result = artly_sync_charges_from_woo();
  wp_send_json_success($result);
}

add_action('wp_ajax_artly_get_charges_count', 'artly_get_charges_count');
function artly_get_charges_count()
{
  check_ajax_referer('artly_sync_charges', '_wpnonce');

  if (!class_exists('WooCommerce')) {
    wp_send_json_success(array('total' => 0));
    return;
  }

  $orders = wc_get_orders(
    array(
      'limit' => -1,
      'status' => array('processing', 'completed', 'on-hold'),
      'return' => 'ids',
    )
  );

  $total = count($orders);
  wp_send_json_success(array('total' => $total));
}

add_action('wp_ajax_artly_get_points_count', 'artly_get_points_count');
function artly_get_points_count()
{
  check_ajax_referer('artly_sync_points', '_wpnonce');
  global $wpdb;

  $total_users = 0;

  if (artly_reminder_bridge_points_table_exists($wpdb)) {
    // Count users with points (for balance sync)
    if (artly_reminder_bridge_user_points_table_exists($wpdb)) {
      $table_name = $wpdb->prefix . 'wc_points_rewards_user_points';
      $total_users = (int) $wpdb->get_var("SELECT COUNT(DISTINCT user_id) FROM {$table_name}");
    } else {
      $log_table = $wpdb->prefix . 'wc_points_rewards_user_points_log';
      $total_users = (int) $wpdb->get_var("SELECT COUNT(DISTINCT user_id) FROM {$log_table}");
    }
  }

  wp_send_json_success(array('total' => $total_users, 'type' => 'users'));
}
function artly_reminder_bridge_admin_menu(): void
{
  add_submenu_page(
    'woocommerce',
    __('Artly Reminder Sync', 'artly-reminder-bridge'),
    __('Artly Reminder Sync', 'artly-reminder-bridge'),
    'manage_woocommerce',
    'artly-reminder-sync',
    'artly_reminder_bridge_render_admin_page'
  );
}

function artly_reminder_bridge_handle_post(): ?string
{
  if (!current_user_can('manage_woocommerce')) {
    return __('You do not have permission to manage this page.', 'artly-reminder-bridge');
  }

  $nonce = isset($_POST['artly_reminder_bridge_nonce']) ? $_POST['artly_reminder_bridge_nonce'] : (isset($_POST['artly_reminder_bridge_nonce_manual']) ? $_POST['artly_reminder_bridge_nonce_manual'] : '');
  if (empty($nonce) || !wp_verify_nonce(sanitize_text_field(wp_unslash($nonce)), 'artly_reminder_bridge_save')) {
    return __('Security check failed.', 'artly-reminder-bridge');
  }

  if (isset($_POST['artly_reminder_engine_url'])) {
    update_option(ARB_ENGINE_URL_OPTION, esc_url_raw(wp_unslash($_POST['artly_reminder_engine_url'])));
  }

  if (isset($_POST['artly_reminder_engine_secret'])) {
    update_option(ARB_ENGINE_SECRET_OPTION, sanitize_text_field(wp_unslash($_POST['artly_reminder_engine_secret'])));
  }

  if (isset($_POST['artly_test_connection'])) {
    $api_url = get_option(ARB_ENGINE_URL_OPTION);
    $api_secret = get_option(ARB_ENGINE_SECRET_OPTION);

    if (empty($api_url) || empty($api_secret)) {
      return '<span style="color: red;">❌ Error: API URL or Secret not configured.</span>';
    }

    $api_url = rtrim($api_url, '/');
    $test_url = $api_url . '/artly/sync/users';

    $response = wp_remote_post(
      $test_url,
      array(
        'headers' => array(
          'Content-Type' => 'application/json',
          'x-artly-secret' => $api_secret,
        ),
        'body' => wp_json_encode(array()),
        'timeout' => 10,
      )
    );

    if (is_wp_error($response)) {
      return '<span style="color: red;">❌ Connection failed: ' . esc_html($response->get_error_message()) . '</span>';
    }

    $code = wp_remote_retrieve_response_code($response);
    if ($code === 401) {
      return '<span style="color: red;">❌ Unauthorized: Invalid API key. Please check your API key matches the one in your RenewalFlow dashboard.</span>';
    } elseif ($code >= 300) {
      $body = wp_remote_retrieve_body($response);
      return '<span style="color: orange;">⚠️ Connection test returned status ' . $code . ': ' . esc_html(substr($body, 0, 100)) . '</span>';
    }

    return '<span style="color: green;">✅ Connection successful! API key is valid.</span>';
  }

  // Users sync is now handled via AJAX (see artly_start_sync_users AJAX handler)
  // if ( isset( $_POST['artly_sync_users'] ) ) {
  //   $result = artly_sync_users_from_woo();
  //   if ( $result['success'] ) {
  //     return '<span style="color: green;">✅ ' . esc_html( $result['message'] ) . ' (' . $result['count'] . ' of ' . $result['total'] . ' users)</span>';
  //   }
  //   return '<span style="color: red;">❌ ' . esc_html( $result['message'] ) . '</span>';
  // }

  if (isset($_POST['artly_sync_points'])) {
    // Manual sync now uses balance sync, not event sync
    $result = artly_sync_points_balances_from_woo();
    if ($result['success']) {
      $msg = $result['message'];
      if ($result['count'] > 0) {
        $msg .= ' (' . $result['count'] . ' user balances)';
      }
      return '<span style="color: green;">✅ ' . esc_html($msg) . '</span>';
    }
    return '<span style="color: red;">❌ ' . esc_html($result['message']) . '</span>';
  }

  // Charges sync is now handled via AJAX (artly_start_sync_charges)
  // Removed old form submission handler

  return __('Settings saved.', 'artly-reminder-bridge');
}

function artly_reminder_bridge_render_admin_page(): void
{
  $message = null;
  if ('POST' === $_SERVER['REQUEST_METHOD']) {
    $message = artly_reminder_bridge_handle_post();
  }

  $last_id = (int) get_option(ARB_LAST_LOG_ID_OPTION, 0);
  $last_sync = get_option(ARB_LAST_SYNC_TIME_OPTION);
  $api_url = get_option(ARB_ENGINE_URL_OPTION);
  $api_secret = get_option(ARB_ENGINE_SECRET_OPTION);
  $user_count = count_users();
  $total_users = (int) $user_count['total_users'];

  // Calculate expected batch size for display - must match the actual batch size used in artly_sync_users_from_woo()
  // The sync function uses batch_size = 10 (reduced to prevent 502 timeouts)
  $expected_batch_size = 10;
  $expected_batches = $total_users > 0 ? ceil($total_users / $expected_batch_size) : 0;
  ?>
  <div class="artly-reminder-wrap">
    <div class="artly-reminder-header">
      <div>
        <div class="artly-reminder-header__title"><?php esc_html_e('Artly Reminder Sync', 'artly-reminder-bridge'); ?>
        </div>
        <div class="artly-reminder-header__subtitle">
          <?php esc_html_e('Bridge between your WooCommerce store and RenewalFlow reminder engine.', 'artly-reminder-bridge'); ?>
        </div>
      </div>
      <div
        class="artly-reminder-status-pill <?php echo (!empty($api_url) && !empty($api_secret)) ? 'is-connected' : 'is-disconnected'; ?>">
        <span
          class="dashicons <?php echo (!empty($api_url) && !empty($api_secret)) ? 'dashicons-yes-alt' : 'dashicons-warning'; ?>"></span>
        <?php echo (!empty($api_url) && !empty($api_secret)) ? esc_html__('Connected', 'artly-reminder-bridge') : esc_html__('Not configured', 'artly-reminder-bridge'); ?>
      </div>
    </div>

    <?php if ($message): ?>
      <div class="artly-reminder-alert">
        <?php echo wp_kses_post($message); ?>
      </div>
    <?php endif; ?>

    <div class="artly-reminder-grid artly-reminder-grid--summary">
      <div class="artly-reminder-card">
        <div class="artly-reminder-card__icon"><span class="dashicons dashicons-admin-users"></span></div>
        <div class="artly-reminder-card__title"><?php esc_html_e('WordPress Users', 'artly-reminder-bridge'); ?></div>
        <div class="artly-reminder-card__value"><?php echo esc_html($total_users); ?></div>
        <p class="artly-reminder-card__desc">
          <?php esc_html_e('Synced into RenewalFlow engine.', 'artly-reminder-bridge'); ?>
        </p>
      </div>
      <div class="artly-reminder-card">
        <div class="artly-reminder-card__icon"><span class="dashicons dashicons-update"></span></div>
        <div class="artly-reminder-card__title"><?php esc_html_e('Sync Strategy', 'artly-reminder-bridge'); ?></div>
        <div class="artly-reminder-card__value">
          <?php if ($total_users > 0): ?>
            <?php printf(esc_html__('Batch size: %d users', 'artly-reminder-bridge'), $expected_batch_size); ?>
          <?php else: ?>
            <?php esc_html_e('No users to sync', 'artly-reminder-bridge'); ?>
          <?php endif; ?>
        </div>
        <p class="artly-reminder-card__desc">
          <?php printf(esc_html__('Expected batches: %d', 'artly-reminder-bridge'), $expected_batches); ?>
        </p>
      </div>
      <div class="artly-reminder-card">
        <div class="artly-reminder-card__icon"><span class="dashicons dashicons-awards"></span></div>
        <div class="artly-reminder-card__title"><?php esc_html_e('Last Points Log ID', 'artly-reminder-bridge'); ?>
        </div>
        <div class="artly-reminder-card__value"><?php echo esc_html((string) $last_id); ?></div>
        <p class="artly-reminder-card__desc">
          <?php esc_html_e('Latest Woo Points entry processed.', 'artly-reminder-bridge'); ?>
        </p>
      </div>
      <div class="artly-reminder-card">
        <div class="artly-reminder-card__icon"><span class="dashicons dashicons-backup"></span></div>
        <div class="artly-reminder-card__title"><?php esc_html_e('Last Sync Time (UTC)', 'artly-reminder-bridge'); ?>
        </div>
        <div class="artly-reminder-card__value">
          <?php echo esc_html($last_sync ? $last_sync : __('Never', 'artly-reminder-bridge')); ?>
        </div>
        <p class="artly-reminder-card__desc"><?php esc_html_e('Auto-sync runs hourly.', 'artly-reminder-bridge'); ?></p>
      </div>
    </div>

    <div class="artly-reminder-grid artly-reminder-grid--two">
      <div class="artly-reminder-card artly-reminder-card--panel">
        <div class="artly-reminder-card__header">
          <div>
            <div class="artly-reminder-card__title">
              <?php esc_html_e('Connection to RenewalFlow', 'artly-reminder-bridge'); ?>
            </div>
            <p class="artly-reminder-card__desc">
              <?php esc_html_e('Configure your RenewalFlow base URL and API key to enable secure syncing.', 'artly-reminder-bridge'); ?>
            </p>
          </div>
        </div>
        <form method="post" class="artly-reminder-form">
          <?php wp_nonce_field('artly_reminder_bridge_save', 'artly_reminder_bridge_nonce'); ?>
          <div class="artly-reminder-form-grid">
            <div class="artly-reminder-form-group">
              <label
                for="artly_reminder_engine_url"><?php esc_html_e('RenewalFlow API Base URL', 'artly-reminder-bridge'); ?></label>
              <input name="artly_reminder_engine_url" type="url" id="artly_reminder_engine_url"
                value="<?php echo esc_attr($api_url); ?>" placeholder="https://renewalflow-production.up.railway.app"
                required />
              <p class="description">
                <?php esc_html_e('Example: https://renewalflow-production.up.railway.app', 'artly-reminder-bridge'); ?>
              </p>
            </div>
            <div class="artly-reminder-form-group">
              <label for="artly_reminder_engine_secret"><?php esc_html_e('API Key', 'artly-reminder-bridge'); ?></label>
              <input name="artly_reminder_engine_secret" type="password" id="artly_reminder_engine_secret"
                value="<?php echo esc_attr($api_secret); ?>" placeholder="artly_workspaceId_..." required />
              <p class="description">
                <?php esc_html_e('Copy this from your RenewalFlow dashboard → Integrations tab. It should start with "artly_".', 'artly-reminder-bridge'); ?>
              </p>
            </div>
          </div>
          <div class="artly-reminder-actions">
            <button type="submit" name="submit"
              class="button artly-reminder-button-primary"><?php esc_html_e('Save settings', 'artly-reminder-bridge'); ?></button>
            <?php if (!empty($api_url) && !empty($api_secret)): ?>
              <button type="submit" name="artly_test_connection" value="1"
                class="button artly-reminder-button-secondary"><?php esc_html_e('Test Connection', 'artly-reminder-bridge'); ?></button>
              <span
                class="artly-reminder-inline-status <?php echo (!empty($api_url) && !empty($api_secret)) ? 'is-connected' : 'is-disconnected'; ?>">
                <span
                  class="dashicons <?php echo (!empty($api_url) && !empty($api_secret)) ? 'dashicons-yes' : 'dashicons-dismiss'; ?>"></span>
                <?php echo (!empty($api_url) && !empty($api_secret)) ? esc_html__('Ready to connect', 'artly-reminder-bridge') : esc_html__('Missing credentials', 'artly-reminder-bridge'); ?>
              </span>
            <?php endif; ?>
          </div>
        </form>
      </div>

      <div class="artly-reminder-card artly-reminder-card--panel">
        <div class="artly-reminder-card__header">
          <div>
            <div class="artly-reminder-card__title"><?php esc_html_e('Manual Sync Tools', 'artly-reminder-bridge'); ?>
            </div>
            <p class="artly-reminder-card__desc">
              <?php esc_html_e('Use these tools to trigger a one-time sync with RenewalFlow. Large syncs are processed in batches.', 'artly-reminder-bridge'); ?>
            </p>
          </div>
        </div>
        <form method="post" class="artly-reminder-manual-form">
          <?php wp_nonce_field('artly_reminder_bridge_save', 'artly_reminder_bridge_nonce_manual'); ?>
          <div class="artly-reminder-manual-grid">
            <div class="artly-reminder-manual-item">
              <div class="artly-reminder-manual-text">
                <div class="artly-reminder-manual-title"><?php esc_html_e('Sync Users', 'artly-reminder-bridge'); ?>
                </div>
                <p><?php esc_html_e('Sync all WordPress users to the Reminder Engine.', 'artly-reminder-bridge'); ?>
                  (<?php echo esc_html($total_users); ?>   <?php esc_html_e('users', 'artly-reminder-bridge'); ?>,
                  ~<?php echo esc_html($expected_batches); ?>
                  <?php esc_html_e('batches', 'artly-reminder-bridge'); ?>)
                </p>
              </div>
              <button type="button" id="artly-sync-users-btn"
                class="button artly-reminder-button-secondary"><?php esc_html_e('Sync Users', 'artly-reminder-bridge'); ?></button>
              <button type="button" id="artly-cancel-users-sync-btn"
                style="display: none; margin-left: 10px; background: #dc3232; color: white; border-color: #dc3232;"><?php esc_html_e('Cancel Sync', 'artly-reminder-bridge'); ?></button>
            </div>
            <div id="artly-users-sync-progress"
              style="display: none; margin-top: 10px; padding: 15px; background: #f9f9f9; border-left: 4px solid #2271b1; max-width: 700px; border-radius: 4px; position: relative;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <p style="margin: 0; font-weight: bold; color: #2271b1;">
                  <i class="dashicons dashicons-update"
                    style="animation: spin 1s linear infinite; display: inline-block; margin-right: 5px;"></i>
                  <?php esc_html_e('Users Sync Progress', 'artly-reminder-bridge'); ?>
                </p>
                <button type="button" id="artly-dismiss-users-progress"
                  style="display: none; background: transparent; border: none; color: #666; cursor: pointer; font-size: 18px; padding: 0; width: 24px; height: 24px; line-height: 1;"
                  title="Dismiss">
                  <span style="font-size: 20px;">×</span>
                </button>
              </div>
              <div id="artly-users-progress-message" style="margin-bottom: 10px; color: #333; font-size: 14px;"></div>
              <div
                style="background: #fff; border: 1px solid #ddd; border-radius: 4px; height: 24px; overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);">
                <div id="artly-users-progress-bar"
                  style="background: linear-gradient(90deg, #2271b1 0%, #135e96 100%); height: 100%; width: 0%; transition: width 0.5s ease; display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: bold; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">
                  <span id="artly-users-progress-percentage">0%</span>
                </div>
              </div>
              <p id="artly-users-progress-stats"
                style="margin: 10px 0 0 0; font-size: 13px; color: #666; line-height: 1.6;">
                <span id="artly-users-progress-details"></span>
              </p>
            </div>
            <div class="artly-reminder-manual-item">
              <div class="artly-reminder-manual-text">
                <div class="artly-reminder-manual-title">
                  <?php esc_html_e('Sync Points Balances', 'artly-reminder-bridge'); ?>
                </div>
                <p id="artly-points-description">
                  <?php
                  global $wpdb;
                  $points_total_users = 0;
                  if (artly_reminder_bridge_points_table_exists($wpdb)) {
                    if (artly_reminder_bridge_user_points_table_exists($wpdb)) {
                      $table_name = $wpdb->prefix . 'wc_points_rewards_user_points';
                      $points_total_users = (int) $wpdb->get_var("SELECT COUNT(DISTINCT user_id) FROM {$table_name}");
                    } else {
                      $log_table = $wpdb->prefix . 'wc_points_rewards_user_points_log';
                      $points_total_users = (int) $wpdb->get_var("SELECT COUNT(DISTINCT user_id) FROM {$log_table}");
                    }
                  }
                  esc_html_e('Push current WooCommerce points to RenewalFlow.', 'artly-reminder-bridge');
                  if ($points_total_users > 0) {
                    echo ' (' . esc_html(number_format($points_total_users)) . ' users with points)';
                  }
                  ?>
                </p>
              </div>
              <div class="artly-reminder-button-group">
                <button type="button" class="button artly-reminder-button-secondary"
                  id="artly-sync-points-btn"><?php esc_html_e('Sync Points Balances', 'artly-reminder-bridge'); ?></button>
                <button type="button" class="button artly-reminder-button-danger" id="artly-cancel-sync-btn"
                  style="display: none;"><?php esc_html_e('Cancel Sync', 'artly-reminder-bridge'); ?></button>
              </div>
            </div>
            <div id="artly-sync-progress" class="artly-reminder-progress" style="display: none;">
              <div class="artly-reminder-progress__header">
                <p>
                  <i class="dashicons dashicons-update"></i>
                  <?php esc_html_e('Points Sync Progress', 'artly-reminder-bridge'); ?>
                </p>
              </div>
              <div id="artly-progress-message" class="artly-reminder-progress__message"></div>
              <div class="artly-reminder-progress__bar">
                <div id="artly-progress-bar" class="artly-reminder-progress__fill"><span
                    id="artly-progress-percentage">0%</span></div>
              </div>
              <p id="artly-progress-stats" class="artly-reminder-progress__stats"><span
                  id="artly-progress-details"></span></p>
            </div>
            <div class="artly-reminder-manual-item">
              <div class="artly-reminder-manual-text">
                <div class="artly-reminder-manual-title">
                  <?php esc_html_e('Sync Charges / Orders', 'artly-reminder-bridge'); ?>
                </div>
                <p id="artly-charges-description">
                  <?php
                  $total_orders = 0;
                  if (class_exists('WooCommerce')) {
                    $orders = wc_get_orders(
                      array(
                        'limit' => -1,
                        'status' => array('processing', 'completed', 'on-hold'),
                        'return' => 'ids',
                      )
                    );
                    $total_orders = count($orders);
                  }
                  esc_html_e('Sync WooCommerce orders used for renewals.', 'artly-reminder-bridge');
                  if ($total_orders > 0) {
                    echo ' (' . esc_html(number_format($total_orders)) . ' orders)';
                  }
                  ?>
                </p>
              </div>
              <div class="artly-reminder-button-group">
                <button type="button" class="button artly-reminder-button-secondary"
                  id="artly-sync-charges-btn"><?php esc_html_e('Sync Charges', 'artly-reminder-bridge'); ?></button>
                <button type="button" class="button artly-reminder-button-danger" id="artly-cancel-charges-sync-btn"
                  style="display: none;"><?php esc_html_e('Cancel Sync', 'artly-reminder-bridge'); ?></button>
              </div>
            </div>
            <div id="artly-charges-sync-progress" class="artly-reminder-progress" style="display: none;">
              <div class="artly-reminder-progress__header">
                <p>
                  <i class="dashicons dashicons-update"></i>
                  <?php esc_html_e('Charges Sync Progress', 'artly-reminder-bridge'); ?>
                </p>
                <button type="button" id="artly-dismiss-charges-progress" class="artly-reminder-dismiss"
                  style="display: none;">×</button>
              </div>
              <div id="artly-charges-progress-message" class="artly-reminder-progress__message"></div>
              <div class="artly-reminder-progress__bar">
                <div id="artly-charges-progress-bar" class="artly-reminder-progress__fill"><span
                    id="artly-charges-progress-percentage">0%</span></div>
              </div>
              <p id="artly-charges-progress-stats" class="artly-reminder-progress__stats"><span
                  id="artly-charges-progress-details"></span></p>
            </div>
          </div>
        </form>
      </div>

      <p class="artly-reminder-footer">
        <?php esc_html_e('Tip: You can view detailed sync logs from the RenewalFlow dashboard.', 'artly-reminder-bridge'); ?>
      </p>
    </div>
    <style>
      .artly-reminder-wrap {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
        color: #0f172a;
      }

      .artly-reminder-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: linear-gradient(90deg, #4f46e5 0%, #6366f1 100%);
        color: #fff;
        padding: 18px 22px;
        border-radius: 12px;
        margin-bottom: 20px;
        box-shadow: 0 10px 25px rgba(79, 70, 229, 0.25);
      }

      .artly-reminder-header__title {
        font-size: 22px;
        font-weight: 700;
        margin-bottom: 6px;
      }

      .artly-reminder-header__subtitle {
        font-size: 14px;
        opacity: 0.9;
      }

      .artly-reminder-status-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        font-weight: 600;
        background: #f97316;
        color: #fff;
      }

      .artly-reminder-status-pill.is-connected {
        background: #16a34a;
      }

      .artly-reminder-grid {
        display: grid;
        gap: 16px;
      }

      .artly-reminder-grid--summary {
        grid-template-columns: repeat(4, minmax(0, 1fr));
        margin-bottom: 20px;
      }

      .artly-reminder-grid--two {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        margin-bottom: 16px;
      }

      @media (max-width: 1100px) {
        .artly-reminder-grid--summary {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .artly-reminder-grid--two {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 700px) {
        .artly-reminder-grid--summary {
          grid-template-columns: 1fr;
        }
      }

      .artly-reminder-card {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }

      .artly-reminder-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 25px rgba(15, 23, 42, 0.12);
      }

      .artly-reminder-card__icon {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #4f46e5;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        margin-bottom: 12px;
        font-size: 18px;
      }

      .artly-reminder-card__title {
        font-weight: 700;
        font-size: 16px;
        margin-bottom: 6px;
        color: #111827;
      }

      .artly-reminder-card__value {
        font-size: 24px;
        font-weight: 700;
        margin-bottom: 4px;
        color: #111827;
      }

      .artly-reminder-card__desc {
        margin: 0;
        color: #6b7280;
        font-size: 13px;
      }

      .artly-reminder-card--panel {
        padding: 18px;
      }

      .artly-reminder-card__header {
        margin-bottom: 10px;
      }

      .artly-reminder-form-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }

      @media (max-width: 900px) {
        .artly-reminder-form-grid {
          grid-template-columns: 1fr;
        }
      }

      .artly-reminder-form-group label {
        display: block;
        font-weight: 600;
        margin-bottom: 6px;
      }

      .artly-reminder-form-group input {
        width: 100%;
        padding: 10px 12px;
        border-radius: 8px;
        border: 1px solid #d1d5db;
        box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.03);
      }

      .artly-reminder-form-group .description {
        color: #6b7280;
        margin-top: 6px;
        font-size: 12px;
      }

      .artly-reminder-actions {
        margin-top: 14px;
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .artly-reminder-button-primary {
        background: #4f46e5 !important;
        border-color: #4f46e5 !important;
        color: #fff !important;
        box-shadow: 0 8px 14px rgba(79, 70, 229, 0.25);
      }

      .artly-reminder-button-secondary {
        background: #eef2ff !important;
        border-color: #c7d2fe !important;
        color: #312e81 !important;
      }

      .artly-reminder-button-danger {
        background: #dc2626 !important;
        border-color: #dc2626 !important;
        color: #fff !important;
      }

      .artly-reminder-inline-status {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        padding: 6px 10px;
        border-radius: 999px;
        background: #fee2e2;
        color: #b91c1c;
      }

      .artly-reminder-inline-status.is-connected {
        background: #dcfce7;
        color: #166534;
      }

      .artly-reminder-manual-grid {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .artly-reminder-manual-item {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
        padding: 12px;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        background: #f8fafc;
      }

      .artly-reminder-manual-title {
        font-weight: 700;
        margin-bottom: 4px;
      }

      .artly-reminder-manual-text p {
        margin: 0;
        color: #475569;
      }

      .artly-reminder-button-group {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
      }

      .artly-reminder-progress {
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 14px;
      }

      .artly-reminder-progress__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        color: #4f46e5;
        font-weight: 700;
      }

      .artly-reminder-progress__header .dashicons-update {
        margin-right: 6px;
        animation: spin 1s linear infinite;
      }

      .artly-reminder-progress__message {
        margin-bottom: 8px;
        color: #0f172a;
      }

      .artly-reminder-progress__bar {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        height: 26px;
        overflow: hidden;
        box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.06);
      }

      .artly-reminder-progress__fill {
        background: linear-gradient(90deg, #6366f1 0%, #4f46e5 100%);
        height: 100%;
        width: 0%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 700;
        transition: width 0.5s ease;
      }

      .artly-reminder-progress__stats {
        margin: 8px 0 0 0;
        color: #475569;
        font-size: 13px;
      }

      .artly-reminder-dismiss {
        background: transparent;
        border: none;
        color: #475569;
        font-size: 20px;
        cursor: pointer;
        line-height: 1;
      }

      .artly-reminder-alert {
        margin-bottom: 16px;
        padding: 12px 14px;
        border-radius: 8px;
        background: #ecfeff;
        border: 1px solid #bae6fd;
        color: #0ea5e9;
        font-weight: 600;
      }

      .artly-reminder-footer {
        color: #94a3b8;
        font-size: 13px;
        margin-top: 10px;
      }

      @keyframes spin {
        from {
          transform: rotate(0deg);
        }

        to {
          transform: rotate(360deg);
        }
      }
    </style>
    <script>
          (func          tion ()       {
            const syncBtn = document.getElementById('artly-sync-points-btn');
            const cancelBtn = document.getElementById('artly-cancel-sync-btn');
            const progressDiv = document.getElementById('artly-sync-progress');
            const progressMessage = document.getElementById('artly-progress-message');
            const progressBar = document.getElementById('artly-progress-bar');
            const progressPercentage = document.getElementById('artly-progress-percentage');
            const progressDetails = document.getElementById('artly-progress-details');
            let progressInterval = null;
            let totalToSync = 0;
            let isCancelled = false;

            function formatNumber(num) {
              return new Intl.NumberFormat().format(num);
            }

            let currentJobId = null;

            function updateProgress() {
              if (!currentJobId) {
                // No job ID, stop polling
                if (syncBtn) {
                  syncBtn.disabled = false;
                }
                if (progressInterval) {
                  clearTimeout(progressInterval);
                }
                return;
              }

              fetch(ajaxurl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                  action: 'artly_get_sync_job_status',
                  jobId: currentJobId,
                  _wpnonce: '<?php echo wp_create_nonce('artly_sync_points'); ?>',
                }),
              })
                .then(response => response.json())
                .then(data => {
                  if (data.success && data.data) {
                    const progress = data.data;

                    if (progress.status === 'running' || progress.status === 'pending') {
                      progressDiv.style.display = 'block';
                      progressMessage.textContent = progress.message || 'Syncing...';

                      const percentage = progress.progress || (progress.total > 0
                        ? Math.min(Math.round((progress.processed / progress.total) * 100), 100)
                        : 0);

                      progressBar.style.width = percentage + '%';
                      progressPercentage.textContent = percentage + '%';

                      const processed = formatNumber(progress.processed || 0);
                      const total = formatNumber(progress.total || 0);
                      const imported = formatNumber(progress.imported || progress.processed || 0);

                      progressDetails.innerHTML = `
              <strong>Processed:</strong> ${processed} / ${total} users<br>
              <strong>Updated:</strong> ${imported} balances<br>
              <strong>Progress:</strong> ${percentage}% complete
            `;

                      // Continue polling every 1-2 seconds
                      if (progressInterval) {
                        clearTimeout(progressInterval);
                      }
                      progressInterval = setTimeout(updateProgress, 1500);

                      // Ensure cancel button is visible
                      if (cancelBtn) {
                        cancelBtn.style.display = 'inline-block';
                      }
                      if (syncBtn) {
                        syncBtn.disabled = true;
                        syncBtn.textContent = 'Syncing...';
                      }
                    } else if (progress.status === 'completed') {
                      progressDiv.style.display = 'block';
                      progressMessage.textContent = progress.message || progress.result?.message || '✅ Sync completed successfully!';
                      progressBar.style.width = '100%';
                      progressBar.style.background = 'linear-gradient(90deg, #46b450 0%, #2e7d32 100%)';
                      progressPercentage.textContent = '100%';

                      const processed = formatNumber(progress.processed || 0);
                      const imported = formatNumber(progress.imported || progress.result?.count || 0);

                      progressDetails.innerHTML = `
              <strong style="color: #46b450;">✓ Completed!</strong><br>
              <strong>Total processed:</strong> ${processed} users<br>
              <strong>Total updated:</strong> ${imported} balances
            `;

                      if (syncBtn) {
                        syncBtn.disabled = false;
                        syncBtn.textContent = '<?php esc_html_e('Sync Points Balances', 'artly-reminder-bridge'); ?>';
                      }
                      if (cancelBtn) {
                        cancelBtn.style.display = 'none';
                      }

                      if (progressInterval) {
                        clearTimeout(progressInterval);
                      }

                      currentJobId = null; // Clear job ID

                      // Clear progress after 8 seconds
                      setTimeout(() => {
                        progressDiv.style.display = 'none';
                        // Reload page to update the count
                        location.reload();
                      }, 8000);
                    } else if (progress.status === 'failed' || progress.status === 'error') {
                      progressDiv.style.display = 'block';
                      progressMessage.textContent = '❌ ' + (progress.error || progress.message || 'Sync failed!');
                      progressBar.style.background = 'linear-gradient(90deg, #dc3232 0%, #b32d2e 100%)';

                      const processed = formatNumber(progress.processed || 0);
                      const total = formatNumber(progress.total || 0);

                      progressDetails.innerHTML = `
              <strong style="color: #dc3232;">✗ Error occurred</strong><br>
              <strong>Processed:</strong> ${processed} / ${total} users<br>
              <strong>Error:</strong> ${progress.error || progress.message || 'Unknown error'}
            `;

                      if (syncBtn) {
                        syncBtn.disabled = false;
                        syncBtn.textContent = '<?php esc_html_e('Sync Points Balances', 'artly-reminder-bridge'); ?>';
                      }
                      if (cancelBtn) {
                        cancelBtn.style.display = 'none';
                      }

                      if (progressInterval) {
                        clearTimeout(progressInterval);
                      }

                      currentJobId = null; // Clear job ID
                    } else if (progress.status === 'cancelled') {
                      progressDiv.style.display = 'block';
                      progressMessage.textContent = '⚠️ Sync cancelled';
                      progressBar.style.background = 'linear-gradient(90deg, #f0b849 0%, #d97706 100%)';

                      if (syncBtn) {
                        syncBtn.disabled = false;
                        syncBtn.textContent = '<?php esc_html_e('Sync Points Balances', 'artly-reminder-bridge'); ?>';
                      }
                      if (cancelBtn) {
                        cancelBtn.style.display = 'none';
                      }

                      if (progressInterval) {
                        clearTimeout(progressInterval);
                      }

                      currentJobId = null; // Clear job ID
                    } else {
                      // Unknown status, stop polling
                      if (syncBtn) {
                        syncBtn.disabled = false;
                      }
                      if (progressInterval) {
                        clearTimeout(progressInterval);
                      }
                      currentJobId = null;
                    }
                  } else {
                    // Error response, stop polling
                    if (syncBtn) {
                      syncBtn.disabled = false;
                      syncBtn.textContent = '<?php esc_html_e('Sync Points Balances', 'artly-reminder-bridge'); ?>';
                    }
                    if (cancelBtn) {
                      cancelBtn.style.display = 'none';
                    }
                    if (progressInterval) {
                      clearTimeout(progressInterval);
                    }
                    currentJobId = null;
                  }
                })
                .catch(error => {
                  console.error('Error fetching progress:', error);
                  if (syncBtn) {
                    syncBtn.disabled = false;
                    syncBtn.textContent = '<?php esc_html_e('Sync Points Balances', 'artly-reminder-bridge'); ?>';
                  }
                  if (cancelBtn) {
                    cancelBtn.style.display = 'none';
                  }
                  if (progressInterval) {
                    clearTimeout(progressInterval);
                  }
                  currentJobId = null;
                });
            }

            if (syncBtn) {
              syncBtn.addEventListener('click', function (e) {
                e.preventDefault();

                // Get total count first
                fetch(ajaxurl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                  },
                  body: new URLSearchParams({
                    action: 'artly_get_points_count',
                    _wpnonce: '<?php echo wp_create_nonce('artly_sync_points'); ?>',
                  }),
                })
                  .then(response => response.json())
                  .then(data => {
                    if (data.success && data.data) {
                      totalToSync = data.data.total || 0;

                      // Show progress immediately
                      progressDiv.style.display = 'block';
                      progressMessage.textContent = 'Initializing balance sync...';
                      progressBar.style.width = '0%';
                      progressBar.style.background = 'linear-gradient(90deg, #2271b1 0%, #135e96 100%)';
                      progressPercentage.textContent = '0%';
                      progressDetails.innerHTML = `
              <strong>Total users to sync:</strong> ${formatNumber(totalToSync)} users<br>
              <strong>Status:</strong> Starting balance sync...
            `;

                      // Disable sync button and show cancel button
                      syncBtn.disabled = true;
                      syncBtn.textContent = 'Syncing...';
                      if (cancelBtn) {
                        cancelBtn.style.display = 'inline-block';
                      }
                      isCancelled = false;

                      // Start the sync via AJAX to get jobId
                      fetch(ajaxurl, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: new URLSearchParams({
                          action: 'artly_start_sync_points',
                          _wpnonce: '<?php echo wp_create_nonce('artly_sync_points'); ?>',
                        }),
                      })
                        .then(response => response.json())
                        .then(data => {
                          if (isCancelled) {
                            return;
                          }

                          if (data.success && data.data && data.data.jobId) {
                            // Store jobId and start polling
                            currentJobId = data.data.jobId;
                            updateProgress(); // Start polling immediately
                          } else {
                            // Error starting sync
                            if (progressInterval) {
                              clearTimeout(progressInterval);
                            }
                            progressMessage.textContent = '❌ ' + (data.data?.message || 'Sync failed to start');
                            progressBar.style.background = 'linear-gradient(90deg, #dc3232 0%, #b32d2e 100%)';
                            syncBtn.disabled = false;
                            syncBtn.textContent = '<?php esc_html_e('Sync Points Balances', 'artly-reminder-bridge'); ?>';
                            if (cancelBtn) {
                              cancelBtn.style.display = 'none';
                            }
                          }
                        })
                        .catch(error => {
                          if (isCancelled) {
                            progressMessage.textContent = '⚠️ Sync was cancelled.';
                            progressBar.style.background = 'linear-gradient(90deg, #f0b849 0%, #d97706 100%)';
                            return;
                          }

                          console.error('Error starting sync:', error);
                          progressMessage.textContent = '❌ Error starting sync. Please try again.';
                          syncBtn.disabled = false;
                          syncBtn.textContent = '<?php esc_html_e('Sync Points Balances', 'artly-reminder-bridge'); ?>';
                          if (cancelBtn) {
                            cancelBtn.style.display = 'none';
                          }
                        });
                    }
                  })
                  .catch(error => {
                    console.error('Error getting count:', error);
                    // Still try to start sync
                    progressDiv.style.display = 'block';
                    progressMessage.textContent = 'Starting sync...';
                    syncBtn.disabled = true;
                    syncBtn.textContent = 'Syncing...';
                    if (cancelBtn) {
                      cancelBtn.style.display = 'inline-block';
                    }
                    isCancelled = false;

                    fetch(ajaxurl, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                      },
                      body: new URLSearchParams({
                        action: 'artly_start_sync_points',
                        _wpnonce: '<?php echo wp_create_nonce('artly_sync_points'); ?>',
                      }),
                    })
                      .then(response => response.json())
                      .then(data => {
                        if (isCancelled) return;

                        if (data.success) {
                          progressMessage.textContent = '✅ ' + (data.data.message || 'Sync completed successfully!');
                          progressBar.style.width = '100%';
                          progressBar.style.background = 'linear-gradient(90deg, #46b450 0%, #2e7d32 100%)';
                          progressPercentage.textContent = '100%';
                          progressDetails.innerHTML = `<strong style="color: #46b450;">✓ Completed!</strong><br><strong>Updated:</strong> ${formatNumber(data.data.count || 0)} balances`;

                          setTimeout(() => {
                            location.reload();
                          }, 2000);
                        } else {
                          progressMessage.textContent = '❌ ' + (data.data?.message || 'Sync failed');
                          progressBar.style.background = 'linear-gradient(90deg, #dc3232 0%, #b32d2e 100%)';
                        }

                        syncBtn.disabled = false;
                        syncBtn.textContent = '<?php esc_html_e('Sync Points Balances', 'artly-reminder-bridge'); ?>';
                        if (cancelBtn) {
                          cancelBtn.style.display = 'none';
                        }
                      })
                      .catch(err => {
                        if (!isCancelled) {
                          progressMessage.textContent = '❌ Error starting sync. Please try again.';
                          syncBtn.disabled = false;
                          syncBtn.textContent = '<?php esc_html_e('Sync Points Balances', 'artly-reminder-bridge'); ?>';
                          if (cancelBtn) {
                            cancelBtn.style.display = 'none';
                          }
                        }
                      });
                  });
              });
            }

            // Cancel button handler
            if (cancelBtn) {
              cancelBtn.addEventListener('click', function (e) {
                e.preventDefault();

                if (confirm('Are you sure you want to cancel the sync?')) {
                  isCancelled = true;

                  // Send cancel request with jobId if available
                  const cancelParams = {
                    action: 'artly_cancel_sync',
                    _wpnonce: '<?php echo wp_create_nonce('artly_sync_points'); ?>',
                  };

                  if (currentJobId) {
                    cancelParams.jobId = currentJobId;
                  }

                  fetch(ajaxurl, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams(cancelParams),
                  })
                    .then(() => {
                      progressMessage.textContent = '⚠️ Cancelling sync...';
                      cancelBtn.disabled = true;
                      cancelBtn.textContent = 'Cancelling...';

                      // Stop polling
                      if (progressInterval) {
                        clearTimeout(progressInterval);
                      }

                      // Wait a moment then update UI
                      setTimeout(() => {
                        progressMessage.textContent = '⚠️ Sync cancelled.';
                        progressBar.style.background = 'linear-gradient(90deg, #f0b849 0%, #d97706 100%)';
                        syncBtn.disabled = false;
                        syncBtn.textContent = '<?php esc_html_e('Sync Points Balances', 'artly-reminder-bridge'); ?>';
                        cancelBtn.style.display = 'none';
                        currentJobId = null;
                        cancelBtn.disabled = false;
                        cancelBtn.textContent = '<?php esc_html_e('Cancel Sync', 'artly-reminder-bridge'); ?>';
                      }, 1000);
                    })
                    .catch(error => {
                      console.error('Error cancelling sync:', error);
                      progressMessage.textContent = '⚠️ Sync cancellation requested.';
                    });
                }
              });
            }

            // Check for existing sync on page load
            updateProgress();
          })();

          // Users sync progress tracking
          (function () {
            const usersSyncBtn = document.getElementById('artly-sync-users-btn');
            const usersCancelBtn = document.getElementById('artly-cancel-users-sync-btn');
            const usersProgressDiv = document.getElementById('artly-users-sync-progress');
            const usersProgressMessage = document.getElementById('artly-users-progress-message');
            const usersProgressBar = document.getElementById('artly-users-progress-bar');
            const usersProgressPercentage = document.getElementById('artly-users-progress-percentage');
            const usersProgressDetails = document.getElementById('artly-users-progress-details');
            const usersDismissBtn = document.getElementById('artly-dismiss-users-progress');
            let usersProgressInterval = null;
            let usersTotalToSync = 0;
            let usersIsCancelled = false;

            function clearUsersProgress() {
              fetch(ajaxurl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                  action: 'artly_clear_sync_progress',
                  _wpnonce: '<?php echo wp_create_nonce('artly_sync_progress'); ?>',
                }),
              })
                .then(() => {
                  usersProgressDiv.style.display = 'none';
                  if (usersSyncBtn) {
                    usersSyncBtn.disabled = false;
                    usersSyncBtn.textContent = '<?php esc_html_e('Sync Users', 'artly-reminder-bridge'); ?>';
                  }
                })
                .catch(error => {
                  console.error('Error clearing progress:', error);
                });
            }

            function formatNumber(num) {
              return new Intl.NumberFormat().format(num);
            }

            function updateUsersProgress() {
              fetch(ajaxurl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                  action: 'artly_get_sync_progress',
                  _wpnonce: '<?php echo wp_create_nonce('artly_sync_progress'); ?>',
                }),
              })
                .then(response => response.json())
                .then(data => {
                  if (data.success && data.data && data.data.type === 'users') {
                    const progress = data.data;

                    if (progress.status === 'running') {
                      usersProgressDiv.style.display = 'block';
                      usersProgressMessage.textContent = progress.message || 'Syncing users...';

                      const percentage = progress.total > 0
                        ? Math.min(Math.round((progress.processed / progress.total) * 100), 100)
                        : 0;

                      usersProgressBar.style.width = percentage + '%';
                      usersProgressPercentage.textContent = percentage + '%';

                      const processed = formatNumber(progress.processed);
                      const total = formatNumber(progress.total);
                      const imported = formatNumber(progress.imported);

                      usersProgressDetails.innerHTML = `
              <strong>Processed:</strong> ${processed} / ${total} users<br>
              <strong>Synced:</strong> ${imported} users<br>
              <strong>Progress:</strong> ${percentage}% complete
            `;

                      if (usersProgressInterval) {
                        clearTimeout(usersProgressInterval);
                      }
                      usersProgressInterval = setTimeout(updateUsersProgress, 800);

                      // Ensure cancel button is visible
                      if (usersCancelBtn) {
                        usersCancelBtn.style.display = 'inline-block';
                      }
                      if (usersSyncBtn) {
                        usersSyncBtn.disabled = true;
                        usersSyncBtn.textContent = 'Syncing...';
                      }
                    } else if (progress.status === 'completed') {
                      usersProgressDiv.style.display = 'block';
                      usersProgressMessage.textContent = progress.message || '✅ Users sync completed successfully!';
                      usersProgressBar.style.width = '100%';
                      usersProgressBar.style.background = 'linear-gradient(90deg, #46b450 0%, #2e7d32 100%)';
                      usersProgressPercentage.textContent = '100%';

                      const processed = formatNumber(progress.processed);
                      const imported = formatNumber(progress.imported);

                      usersProgressDetails.innerHTML = `
              <strong style="color: #46b450;">✓ Completed!</strong><br>
              <strong>Total processed:</strong> ${processed} users<br>
              <strong>Total synced:</strong> ${imported} users
            `;

                      if (usersSyncBtn) {
                        usersSyncBtn.disabled = false;
                        usersSyncBtn.textContent = '<?php esc_html_e('Sync Users', 'artly-reminder-bridge'); ?>';
                      }
                      if (usersCancelBtn) {
                        usersCancelBtn.style.display = 'none';
                      }
                      if (usersDismissBtn) {
                        usersDismissBtn.style.display = 'block';
                      }

                      if (usersProgressInterval) {
                        clearTimeout(usersProgressInterval);
                      }

                      clearUsersProgress();

                      setTimeout(() => {
                        usersProgressDiv.style.display = 'none';
                        if (usersDismissBtn) {
                          usersDismissBtn.style.display = 'none';
                        }
                      }, 5000);
                    } else if (progress.status === 'error') {
                      usersProgressDiv.style.display = 'block';
                      usersProgressMessage.textContent = '❌ ' + (progress.message || 'Sync failed!');
                      usersProgressBar.style.background = 'linear-gradient(90deg, #dc3232 0%, #b32d2e 100%)';

                      const processed = formatNumber(progress.processed || 0);
                      const total = formatNumber(progress.total || 0);

                      usersProgressDetails.innerHTML = `
              <strong style="color: #dc3232;">✗ Error occurred</strong><br>
              <strong>Processed:</strong> ${processed} / ${total} users
            `;

                      if (usersSyncBtn) {
                        usersSyncBtn.disabled = false;
                        usersSyncBtn.textContent = '<?php esc_html_e('Sync Users', 'artly-reminder-bridge'); ?>';
                      }
                      if (usersCancelBtn) {
                        usersCancelBtn.style.display = 'none';
                      }
                      if (usersDismissBtn) {
                        usersDismissBtn.style.display = 'block';
                      }

                      if (usersProgressInterval) {
                        clearTimeout(usersProgressInterval);
                      }

                      clearUsersProgress();
                    } else if (progress.status === 'cancelled') {
                      usersProgressDiv.style.display = 'block';
                      usersProgressMessage.textContent = '⚠️ Sync cancelled by user.';
                      usersProgressBar.style.background = 'linear-gradient(90deg, #f0b849 0%, #d97706 100%)';

                      const processed = formatNumber(progress.processed || 0);
                      const total = formatNumber(progress.total || 0);

                      usersProgressDetails.innerHTML = `
              <strong style="color: #d97706;">✗ Cancelled</strong><br>
              <strong>Processed:</strong> ${processed} / ${total} users
            `;

                      if (usersSyncBtn) {
                        usersSyncBtn.disabled = false;
                        usersSyncBtn.textContent = '<?php esc_html_e('Sync Users', 'artly-reminder-bridge'); ?>';
                      }
                      if (usersCancelBtn) {
                        usersCancelBtn.style.display = 'none';
                      }
                      if (usersDismissBtn) {
                        usersDismissBtn.style.display = 'block';
                      }

                      if (usersProgressInterval) {
                        clearTimeout(usersProgressInterval);
                      }

                      clearUsersProgress();
                    } else {
                      if (usersProgressInterval) {
                        clearTimeout(usersProgressInterval);
                      }
                    }
                  } else {
                    if (usersProgressInterval) {
                      clearTimeout(usersProgressInterval);
                    }
                  }
                })
                .catch(error => {
                  console.error('Error fetching users progress:', error);
                  if (usersProgressInterval) {
                    clearTimeout(usersProgressInterval);
                  }
                });
            }

            if (usersSyncBtn) {
              usersSyncBtn.addEventListener('click', function (e) {
                e.preventDefault();

                usersIsCancelled = false;

                fetch(ajaxurl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                  },
                  body: new URLSearchParams({
                    action: 'artly_get_users_count',
                    _wpnonce: '<?php echo wp_create_nonce('artly_sync_users'); ?>',
                  }),
                })
                  .then(response => response.json())
                  .then(data => {
                    if (data.success && data.data) {
                      usersTotalToSync = data.data.total || 0;

                      usersProgressDiv.style.display = 'block';
                      usersProgressMessage.textContent = 'Initializing users sync...';
                      usersProgressBar.style.width = '0%';
                      usersProgressBar.style.background = 'linear-gradient(90deg, #2271b1 0%, #135e96 100%)';
                      usersProgressPercentage.textContent = '0%';
                      usersProgressDetails.innerHTML = `
              <strong>Total to sync:</strong> ${formatNumber(usersTotalToSync)} users<br>
              <strong>Status:</strong> Starting...
            `;

                      usersSyncBtn.disabled = true;
                      usersSyncBtn.textContent = 'Syncing...';
                      if (usersCancelBtn) {
                        usersCancelBtn.style.display = 'inline-block';
                      }

                      fetch(ajaxurl, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: new URLSearchParams({
                          action: 'artly_start_sync_users',
                          _wpnonce: '<?php echo wp_create_nonce('artly_sync_users'); ?>',
                        }),
                      })
                        .then(response => response.json())
                        .then(data => {
                          if (usersIsCancelled) {
                            usersProgressMessage.textContent = '⚠️ Sync was cancelled.';
                            usersProgressBar.style.background = 'linear-gradient(90deg, #f0b849 0%, #d97706 100%)';
                            return;
                          }

                          if (data.success) {
                            updateUsersProgress();
                          } else {
                            usersProgressMessage.textContent = '❌ ' + (data.data?.message || 'Sync failed');
                            usersProgressBar.style.background = 'linear-gradient(90deg, #dc3232 0%, #b32d2e 100%)';
                            usersProgressDetails.innerHTML = `<strong style="color: #dc3232;">✗ Error occurred</strong><br><strong>Message:</strong> ${data.data?.message || 'Unknown error'}`;

                            if (usersSyncBtn) {
                              usersSyncBtn.disabled = false;
                              usersSyncBtn.textContent = '<?php esc_html_e('Sync Users', 'artly-reminder-bridge'); ?>';
                            }
                            if (usersCancelBtn) {
                              usersCancelBtn.style.display = 'none';
                            }
                          }
                        })
                        .catch(error => {
                          console.error('Error during users sync:', error);
                          usersProgressMessage.textContent = '❌ An unexpected error occurred during sync.';
                          usersProgressBar.style.background = 'linear-gradient(90deg, #dc3232 0%, #b32d2e 100%)';
                          usersProgressDetails.innerHTML = `<strong style="color: #dc3232;">✗ Error occurred</strong><br><strong>Message:</strong> ${error.message || 'Network error'}`;

                          if (usersSyncBtn) {
                            usersSyncBtn.disabled = false;
                            usersSyncBtn.textContent = '<?php esc_html_e('Sync Users', 'artly-reminder-bridge'); ?>';
                          }
                          if (usersCancelBtn) {
                            usersCancelBtn.style.display = 'none';
                          }
                        });
                    }
                  })
                  .catch(err => {
                    console.error('Error getting users count:', err);
                  });
              });
            }

            if (usersCancelBtn) {
              usersCancelBtn.addEventListener('click', function (e) {
                e.preventDefault();
                if (confirm('Are you sure you want to cancel the sync?')) {
                  usersIsCancelled = true;

                  fetch(ajaxurl, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                      action: 'artly_cancel_sync',
                      _wpnonce: '<?php echo wp_create_nonce('artly_sync_users'); ?>',
                    }),
                  })
                    .then(() => {
                      usersProgressMessage.textContent = '⚠️ Cancelling sync...';
                      usersCancelBtn.disabled = true;
                    })
                    .catch(error => {
                      console.error('Error cancelling sync:', error);
                    });
                }
              });
            }

            if (usersDismissBtn) {
              usersDismissBtn.addEventListener('click', function (e) {
                e.preventDefault();
                clearUsersProgress();
              });
            }

            updateUsersProgress();
          })();

          // Charges sync progress tracking
          (function () {
            const chargesSyncBtn = document.getElementById('artly-sync-charges-btn');
            const chargesCancelBtn = document.getElementById('artly-cancel-charges-sync-btn');
            const chargesProgressDiv = document.getElementById('artly-charges-sync-progress');
            const chargesProgressMessage = document.getElementById('artly-charges-progress-message');
            const chargesProgressBar = document.getElementById('artly-charges-progress-bar');
            const chargesProgressPercentage = document.getElementById('artly-charges-progress-percentage');
            const chargesProgressDetails = document.getElementById('artly-charges-progress-details');
            const chargesDescription = document.getElementById('artly-charges-description');
            const chargesDismissBtn = document.getElementById('artly-dismiss-charges-progress');
            let chargesProgressInterval = null;
            let chargesTotalToSync = 0;
            let chargesIsCancelled = false;

            function clearChargesProgress() {
              fetch(ajaxurl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                  action: 'artly_clear_sync_progress',
                  _wpnonce: '<?php echo wp_create_nonce('artly_sync_progress'); ?>',
                }),
              })
                .then(() => {
                  chargesProgressDiv.style.display = 'none';
                  if (chargesSyncBtn) {
                    chargesSyncBtn.disabled = false;
                    chargesSyncBtn.textContent = '<?php esc_html_e('Sync Charges', 'artly-reminder-bridge'); ?>';
                  }
                })
                .catch(error => {
                  console.error('Error clearing progress:', error);
                });
            }

            function formatNumber(num) {
              return new Intl.NumberFormat().format(num);
            }

            function updateChargesProgress() {
              fetch(ajaxurl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                  action: 'artly_get_sync_progress',
                  _wpnonce: '<?php echo wp_create_nonce('artly_sync_progress'); ?>',
                }),
              })
                .then(response => response.json())
                .then(data => {
                  if (data.success && data.data && data.data.type === 'charges') {
                    const progress = data.data;

                    if (progress.status === 'running') {
                      chargesProgressDiv.style.display = 'block';
                      chargesProgressMessage.textContent = progress.message || 'Syncing charges...';

                      const percentage = progress.total > 0
                        ? Math.min(Math.round((progress.processed / progress.total) * 100), 100)
                        : 0;

                      chargesProgressBar.style.width = percentage + '%';
                      chargesProgressPercentage.textContent = percentage + '%';

                      const processed = formatNumber(progress.processed);
                      const total = formatNumber(progress.total);
                      const imported = formatNumber(progress.imported);

                      chargesProgressDetails.innerHTML = `
              <strong>Processed:</strong> ${processed} / ${total} orders<br>
              <strong>Synced:</strong> ${imported} charges<br>
              <strong>Progress:</strong> ${percentage}% complete
            `;

                      if (chargesProgressInterval) {
                        clearTimeout(chargesProgressInterval);
                      }
                      chargesProgressInterval = setTimeout(updateChargesProgress, 800);

                      // Ensure cancel button is visible
                      if (chargesCancelBtn) {
                        chargesCancelBtn.style.display = 'inline-block';
                      }
                      if (chargesSyncBtn) {
                        chargesSyncBtn.disabled = true;
                        chargesSyncBtn.textContent = 'Syncing...';
                      }
                    } else if (progress.status === 'completed') {
                      chargesProgressDiv.style.display = 'block';
                      chargesProgressMessage.textContent = progress.message || '✅ Sync completed successfully!';
                      chargesProgressBar.style.width = '100%';
                      chargesProgressBar.style.background = 'linear-gradient(90deg, #46b450 0%, #2e7d32 100%)';
                      chargesProgressPercentage.textContent = '100%';

                      const processed = formatNumber(progress.processed);
                      const imported = formatNumber(progress.imported);

                      chargesProgressDetails.innerHTML = `
              <strong style="color: #46b450;">✓ Completed!</strong><br>
              <strong>Total processed:</strong> ${processed} orders<br>
              <strong>Total synced:</strong> ${imported} charges
            `;

                      if (chargesSyncBtn) {
                        chargesSyncBtn.disabled = false;
                        chargesSyncBtn.textContent = '<?php esc_html_e('Sync Charges', 'artly-reminder-bridge'); ?>';
                      }
                      if (chargesCancelBtn) {
                        chargesCancelBtn.style.display = 'none';
                      }
                      if (chargesDismissBtn) {
                        chargesDismissBtn.style.display = 'block';
                      }

                      if (chargesProgressInterval) {
                        clearTimeout(chargesProgressInterval);
                      }

                      // Clear progress on backend
                      clearChargesProgress();

                      // Auto-hide after 5 seconds (instead of reloading)
                      setTimeout(() => {
                        chargesProgressDiv.style.display = 'none';
                        if (chargesDismissBtn) {
                          chargesDismissBtn.style.display = 'none';
                        }
                      }, 5000);
                    } else if (progress.status === 'error') {
                      chargesProgressDiv.style.display = 'block';
                      chargesProgressMessage.textContent = '❌ ' + (progress.message || 'Sync failed!');
                      chargesProgressBar.style.background = 'linear-gradient(90deg, #dc3232 0%, #b32d2e 100%)';

                      const processed = formatNumber(progress.processed || 0);
                      const total = formatNumber(progress.total || 0);

                      chargesProgressDetails.innerHTML = `
              <strong style="color: #dc3232;">✗ Error occurred</strong><br>
              <strong>Processed:</strong> ${processed} / ${total} orders
            `;

                      if (chargesSyncBtn) {
                        chargesSyncBtn.disabled = false;
                        chargesSyncBtn.textContent = '<?php esc_html_e('Sync Charges', 'artly-reminder-bridge'); ?>';
                      }
                      if (chargesCancelBtn) {
                        chargesCancelBtn.style.display = 'none';
                      }
                      if (chargesDismissBtn) {
                        chargesDismissBtn.style.display = 'block';
                      }

                      if (chargesProgressInterval) {
                        clearTimeout(chargesProgressInterval);
                      }

                      // Clear progress on backend
                      clearChargesProgress();
                    } else if (progress.status === 'cancelled') {
                      chargesProgressDiv.style.display = 'block';
                      chargesProgressMessage.textContent = '⚠️ Sync cancelled by user.';
                      chargesProgressBar.style.background = 'linear-gradient(90deg, #f0b849 0%, #d97706 100%)';

                      const processed = formatNumber(progress.processed || 0);
                      const total = formatNumber(progress.total || 0);

                      chargesProgressDetails.innerHTML = `
              <strong style="color: #d97706;">✗ Cancelled</strong><br>
              <strong>Processed:</strong> ${processed} / ${total} orders
            `;

                      if (chargesSyncBtn) {
                        chargesSyncBtn.disabled = false;
                        chargesSyncBtn.textContent = '<?php esc_html_e('Sync Charges', 'artly-reminder-bridge'); ?>';
                      }
                      if (chargesCancelBtn) {
                        chargesCancelBtn.style.display = 'none';
                      }
                      if (chargesDismissBtn) {
                        chargesDismissBtn.style.display = 'block';
                      }

                      if (chargesProgressInterval) {
                        clearTimeout(chargesProgressInterval);
                      }

                      // Clear progress on backend
                      clearChargesProgress();
                    }
                  } else if (data.success && data.data && (data.data.status === 'completed' || data.data.status === 'error' || data.data.status === 'cancelled')) {
                    // Show completed/error/cancelled status from previous sync
                    const progress = data.data;
                    if (progress.type === 'charges') {
                      if (progress.status === 'completed') {
                        chargesProgressDiv.style.display = 'block';
                        chargesProgressMessage.textContent = progress.message || '✅ Sync completed successfully!';
                        chargesProgressBar.style.width = '100%';
                        chargesProgressBar.style.background = 'linear-gradient(90deg, #46b450 0%, #2e7d32 100%)';
                        chargesProgressPercentage.textContent = '100%';
                        const processed = formatNumber(progress.processed || 0);
                        const imported = formatNumber(progress.imported || 0);
                        chargesProgressDetails.innerHTML = `
                <strong style="color: #46b450;">✓ Completed!</strong><br>
                <strong>Total processed:</strong> ${processed} orders<br>
                <strong>Total synced:</strong> ${imported} charges
              `;
                        if (chargesDismissBtn) {
                          chargesDismissBtn.style.display = 'block';
                        }
                      } else if (progress.status === 'error') {
                        chargesProgressDiv.style.display = 'block';
                        chargesProgressMessage.textContent = '❌ ' + (progress.message || 'Sync failed!');
                        chargesProgressBar.style.background = 'linear-gradient(90deg, #dc3232 0%, #b32d2e 100%)';
                        const processed = formatNumber(progress.processed || 0);
                        const total = formatNumber(progress.total || 0);
                        chargesProgressDetails.innerHTML = `
                <strong style="color: #dc3232;">✗ Error occurred</strong><br>
                <strong>Processed:</strong> ${processed} / ${total} orders
              `;
                        if (chargesDismissBtn) {
                          chargesDismissBtn.style.display = 'block';
                        }
                      } else if (progress.status === 'cancelled') {
                        chargesProgressDiv.style.display = 'block';
                        chargesProgressMessage.textContent = '⚠️ Sync cancelled by user.';
                        chargesProgressBar.style.background = 'linear-gradient(90deg, #f0b849 0%, #d97706 100%)';
                        const processed = formatNumber(progress.processed || 0);
                        const total = formatNumber(progress.total || 0);
                        chargesProgressDetails.innerHTML = `
                <strong style="color: #d97706;">✗ Cancelled</strong><br>
                <strong>Processed:</strong> ${processed} / ${total} orders
              `;
                        if (chargesDismissBtn) {
                          chargesDismissBtn.style.display = 'block';
                        }
                      }
                      if (chargesSyncBtn) {
                        chargesSyncBtn.disabled = false;
                        chargesSyncBtn.textContent = '<?php esc_html_e('Sync Charges', 'artly-reminder-bridge'); ?>';
                      }
                    }
                  } else {
                    // No active charges sync
                    if (chargesProgressInterval) {
                      clearTimeout(chargesProgressInterval);
                    }
                  }
                })
                .catch(error => {
                  console.error('Error fetching charges progress:', error);
                  if (chargesProgressInterval) {
                    clearTimeout(chargesProgressInterval);
                  }
                });
            }

            if (chargesSyncBtn) {
              chargesSyncBtn.addEventListener('click', function (e) {
                e.preventDefault();

                chargesIsCancelled = false;

                // Get total count first
                fetch(ajaxurl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                  },
                  body: new URLSearchParams({
                    action: 'artly_get_charges_count',
                    _wpnonce: '<?php echo wp_create_nonce('artly_sync_charges'); ?>',
                  }),
                })
                  .then(response => response.json())
                  .then(data => {
                    if (data.success && data.data) {
                      chargesTotalToSync = data.data.total;

                      // Update description
                      if (chargesDescription) {
                        chargesDescription.innerHTML = '<?php esc_html_e('Sync WooCommerce orders/charges to the Reminder Engine.', 'artly-reminder-bridge'); ?> (' + formatNumber(chargesTotalToSync) + ' orders)';
                      }

                      // Show progress immediately
                      chargesProgressDiv.style.display = 'block';
                      chargesProgressMessage.textContent = 'Initializing charges sync...';
                      chargesProgressBar.style.width = '0%';
                      chargesProgressBar.style.background = 'linear-gradient(90deg, #2271b1 0%, #135e96 100%)';
                      chargesProgressPercentage.textContent = '0%';
                      chargesProgressDetails.innerHTML = `
              <strong>Total to sync:</strong> ${formatNumber(chargesTotalToSync)} orders<br>
              <strong>Status:</strong> Starting...
            `;

                      // Disable sync button and show cancel button
                      chargesSyncBtn.disabled = true;
                      chargesSyncBtn.textContent = 'Syncing...';
                      if (chargesCancelBtn) {
                        chargesCancelBtn.style.display = 'inline-block';
                      }

                      // Start the sync via AJAX
                      fetch(ajaxurl, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: new URLSearchParams({
                          action: 'artly_start_sync_charges',
                          _wpnonce: '<?php echo wp_create_nonce('artly_sync_charges'); ?>',
                        }),
                      })
                        .then(response => response.json())
                        .then(data => {
                          if (chargesIsCancelled) {
                            chargesProgressMessage.textContent = '⚠️ Sync was cancelled.';
                            chargesProgressBar.style.background = 'linear-gradient(90deg, #f0b849 0%, #d97706 100%)';
                            return;
                          }

                          if (data.success) {
                            // Start polling for progress
                            updateChargesProgress();
                          } else {
                            chargesProgressMessage.textContent = '❌ ' + (data.data?.message || 'Sync failed');
                            chargesProgressBar.style.background = 'linear-gradient(90deg, #dc3232 0%, #b32d2e 100%)';
                            chargesProgressDetails.innerHTML = `<strong style="color: #dc3232;">✗ Error occurred</strong><br><strong>Message:</strong> ${data.data?.message || 'Unknown error'}`;

                            if (chargesSyncBtn) {
                              chargesSyncBtn.disabled = false;
                              chargesSyncBtn.textContent = '<?php esc_html_e('Sync Charges', 'artly-reminder-bridge'); ?>';
                            }
                            if (chargesCancelBtn) {
                              chargesCancelBtn.style.display = 'none';
                            }
                          }
                        })
                        .catch(error => {
                          console.error('Error during charges sync:', error);
                          chargesProgressMessage.textContent = '❌ An unexpected error occurred during sync.';
                          chargesProgressBar.style.background = 'linear-gradient(90deg, #dc3232 0%, #b32d2e 100%)';
                          chargesProgressDetails.innerHTML = `<strong style="color: #dc3232;">✗ Error occurred</strong><br><strong>Message:</strong> ${error.message || 'Network error'}`;

                          if (chargesSyncBtn) {
                            chargesSyncBtn.disabled = false;
                            chargesSyncBtn.textContent = '<?php esc_html_e('Sync Charges', 'artly-reminder-bridge'); ?>';
                          }
                          if (chargesCancelBtn) {
                            chargesCancelBtn.style.display = 'none';
                          }
                        });
                    }
                  })
                  .catch(error => {
                    console.error('Error getting charges count:', error);
                    // Still try to start sync
                    chargesProgressDiv.style.display = 'block';
                    chargesProgressMessage.textContent = 'Starting sync...';
                    chargesSyncBtn.disabled = true;
                    chargesSyncBtn.textContent = 'Syncing...';
                    if (chargesCancelBtn) {
                      chargesCancelBtn.style.display = 'inline-block';
                    }
                    chargesIsCancelled = false;

                    fetch(ajaxurl, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                      },
                      body: new URLSearchParams({
                        action: 'artly_start_sync_charges',
                        _wpnonce: '<?php echo wp_create_nonce('artly_sync_charges'); ?>',
                      }),
                    })
                      .then(response => response.json())
                      .then(data => {
                        if (chargesIsCancelled) {
                          chargesProgressMessage.textContent = '⚠️ Sync was cancelled.';
                          chargesProgressBar.style.background = 'linear-gradient(90deg, #f0b849 0%, #d97706 100%)';
                          return;
                        }

                        if (data.success) {
                          updateChargesProgress();
                        } else {
                          chargesProgressMessage.textContent = '❌ ' + (data.data?.message || 'Sync failed');
                          chargesProgressBar.style.background = 'linear-gradient(90deg, #dc3232 0%, #b32d2e 100%)';
                          chargesProgressDetails.innerHTML = `<strong style="color: #dc3232;">✗ Error occurred</strong><br><strong>Message:</strong> ${data.data?.message || 'Unknown error'}`;

                          if (chargesSyncBtn) {
                            chargesSyncBtn.disabled = false;
                            chargesSyncBtn.textContent = '<?php esc_html_e('Sync Charges', 'artly-reminder-bridge'); ?>';
                          }
                          if (chargesCancelBtn) {
                            chargesCancelBtn.style.display = 'none';
                          }
                        }
                      })
                      .catch(error => {
                        console.error('Error during charges sync:', error);
                        chargesProgressMessage.textContent = '❌ An unexpected error occurred during sync.';
                        chargesProgressBar.style.background = 'linear-gradient(90deg, #dc3232 0%, #b32d2e 100%)';
                        chargesProgressDetails.innerHTML = `<strong style="color: #dc3232;">✗ Error occurred</strong><br><strong>Message:</strong> ${error.message || 'Network error'}`;

                        if (chargesSyncBtn) {
                          chargesSyncBtn.disabled = false;
                          chargesSyncBtn.textContent = '<?php esc_html_e('Sync Charges', 'artly-reminder-bridge'); ?>';
                        }
                        if (chargesCancelBtn) {
                          chargesCancelBtn.style.display = 'none';
                        }
                      });
                  });
              });

              if (chargesCancelBtn) {
                chargesCancelBtn.addEventListener('click', function (e) {
                  e.preventDefault();
                  if (confirm('Are you sure you want to cancel the sync?')) {
                    chargesIsCancelled = true;
                    chargesProgressMessage.textContent = 'Cancelling sync...';
                    chargesProgressBar.style.background = 'linear-gradient(90deg, #f0b849 0%, #d97706 100%)';
                    chargesSyncBtn.disabled = true;
                    chargesCancelBtn.disabled = true;

                    fetch(ajaxurl, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                      },
                      body: new URLSearchParams({
                        action: 'artly_cancel_sync',
                        _wpnonce: '<?php echo wp_create_nonce('artly_sync_charges'); ?>',
                      }),
                    })
                      .then(response => response.json())
                      .then(data => {
                        console.log('Cancel response:', data);
                      })
                      .catch(error => {
                        console.error('Error sending cancel request:', error);
                        chargesProgressMessage.textContent = '❌ Error requesting cancellation.';
                        chargesProgressBar.style.background = 'linear-gradient(90deg, #dc3232 0%, #b32d2e 100%)';
                      })
                      .finally(() => {
                        chargesCancelBtn.disabled = false;
                      });
                  }
                });
              }

              // Dismiss button handler
              if (chargesDismissBtn) {
                chargesDismissBtn.addEventListener('click', function (e) {
                  e.preventDefault();
                  clearChargesProgress();
                });
              }

              // Initial check for ongoing sync when page loads
              updateChargesProgress();
            }
          })();
        </script>
        <?php
}

/**
 * Real-time Sync for Points Changes
 */
add_action('wc_points_rewards_user_points_changed', 'artly_on_points_changed', 10, 5);

function artly_on_points_changed($user_id, $points_balance, $points_delta, $event_slug = '', $data = null)
{
  $user = get_userdata($user_id);
  if (!$user)
    return;

  // Attempt to get description from data
  $description = $event_slug;
  if ($data && is_array($data) && isset($data['admin_user_id'])) {
    $description .= ' (Manual update)';
  }

  $payload = array(
    'email' => $user->user_email,
    'points_balance' => (int) $points_balance,
    'change_amount' => (int) $points_delta,
    'description' => (string) $description,
    'event_date' => gmdate('c'),
    'external_id' => uniqid('evt_', true)
  );

  // Send to webhook endpoint
  artly_reminder_bridge_post_to_api('api/webhooks/woo/points', $payload);
}

// Register History Endpoint
add_action('rest_api_init', 'artly_register_history_route');
function artly_register_history_route()
{
  register_rest_route('artly/v1', '/user-history', array(
    'methods' => 'GET',
    'callback' => 'artly_get_user_history',
    'permission_callback' => '__return_true',
  ));
}

function artly_get_user_history($request)
{
  $secret = $request->get_param('secret');
  // Simple check or use the stored secret option if preferred, but for now match wooService hardcode
  if ($secret !== 'renewalflow_secure_sync_2024') {
    return new WP_Error('forbidden', 'Invalid secret', array('status' => 403));
  }

  $email = $request->get_param('email');
  $user = get_user_by('email', $email);
  if (!$user) {
    return array();
  }

  global $wpdb;
  $table = $wpdb->prefix . 'wc_points_rewards_user_points_log';
  // Check if table exists
  if ($wpdb->get_var("SHOW TABLES LIKE '$table'") != $table) {
    return array();
  }

  $date_limit = date('Y-m-d H:i:s', strtotime('-30 days'));

  $results = $wpdb->get_results($wpdb->prepare(
    "SELECT * FROM $table WHERE user_id = %d AND date >= %s ORDER BY date DESC",
    $user->ID,
    $date_limit
  ));

  return $results;
}