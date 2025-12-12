<?php
/**
 * Plugin Name: RenewalFlow Sync
 * Description: Connect your WooCommerce store to the RenewalFlow engine. Syncs paid orders to calculate subscription renewals.
 * Version: 2.1.0
 * Author: RenewalFlow
 */

if (!defined('ABSPATH')) {
  exit;
}

const ARB_LAST_ORDER_ID_OPTION = '_artly_last_synced_order_id';
const ARB_LAST_SYNC_TIME_OPTION = '_artly_last_order_sync_time';
const ARB_ENGINE_URL_OPTION = '_artly_reminder_engine_url';
const ARB_ENGINE_SECRET_OPTION = '_artly_reminder_engine_secret';
const ARB_CRON_HOOK = 'artly_orders_sync_cron';

register_activation_hook(__FILE__, 'artly_reminder_bridge_activate');
function artly_reminder_bridge_activate(): void
{
  if (!wp_next_scheduled(ARB_CRON_HOOK)) {
    wp_schedule_event(time(), 'hourly', ARB_CRON_HOOK);
  }

  add_option(ARB_LAST_ORDER_ID_OPTION, 0);
  add_option(ARB_LAST_SYNC_TIME_OPTION, null);
  add_option(ARB_ENGINE_URL_OPTION, 'https://api.renewalflow.com/api/woo/sync-orders');
  add_option(ARB_ENGINE_SECRET_OPTION, '');
}

add_action(ARB_CRON_HOOK, 'artly_sync_orders_from_woo');

function artly_reminder_bridge_log(string $message): void
{
  if (function_exists('wc_get_logger')) {
    $logger = wc_get_logger();
    $logger->info($message, array('source' => 'renewalflow-sync'));
  } else {
    error_log('[renewalflow-sync] ' . $message);
  }
}

/**
 * Fetch a batch of orders that are newer than the last synced ID.
 * We only care about orders that are 'paid' effectively (processing or completed).
 */
function artly_reminder_bridge_fetch_orders_batch(int $last_id): array
{
  // We use wc_get_orders standard function
  // But since it doesn't support 'id > X' directly in a simple way without filters, 
  // performance-wise for large stores, direct DB query or careful loop is needed.
  // simpler approach: standard WP Loop arguments for 'post__in' is too heavy.
  // Let's use standard wc_get_orders with order by ID.

  // However, wc_get_orders doesn't easily support "ID greater than".
  // We will use a direct WP_Query logic via wc_get_orders arguments if possible, 
  // or fallback to raw DB for performance if needed. 
  // Standard approach:

  $args = array(
    'limit' => 50, // Small batch to prevent timeouts
    'orderby' => 'id',
    'order' => 'ASC',
    'status' => array('wc-processing', 'wc-completed'),
    'type' => 'shop_order',
  );

  // There isn't a native 'min_id' param in wc_get_orders. 
  // We can use the 'date_created' as a cursor if ID is tricky, but ID is requested.
  // Let's rely on a custom query filter for ID > last_id to be safe and efficient.

  add_filter('woocommerce_order_data_store_cpt_get_orders_query', function ($query_args, $query_vars) use ($last_id) {
    $query_args['post__not_in'] = range(0, $last_id); // This is bad for huge counts.
    // Better: Use 'where' filter on SQL.
    return $query_args;
  }, 10, 2);

  // Actually, writing a raw DB query for IDs is safer for the "Next Batch" logic
  // then fetching objects.
  global $wpdb;

  $statuses = array('wc-processing', 'wc-completed');
  $status_string = "'" . implode("','", $statuses) . "'";

  $sql = "
        SELECT ID FROM {$wpdb->posts}
        WHERE post_type = 'shop_order'
        AND post_status IN ($status_string)
        AND ID > %d
        ORDER BY ID ASC
        LIMIT 50
    ";

  $order_ids = $wpdb->get_col($wpdb->prepare($sql, $last_id));

  if (empty($order_ids)) {
    return array();
  }

  // Now hydrate these IDs into WC_Order objects
  $orders = array();
  foreach ($order_ids as $oid) {
    $order = wc_get_order($oid);
    if ($order) {
      $orders[] = $order;
    }
  }

  return $orders;
}

function artly_reminder_bridge_build_order_payload(WC_Order $order): ?array
{
  $customer_id = $order->get_customer_id();

  // Requirement: Must be a registered user (customer_id > 0)
  if (!$customer_id || $customer_id <= 0) {
    // Option: Log this? For now, we skip guests as per requirement "Registered Account Email"
    return null;
  }

  // Requirement: Get user from DB, ignore billing email
  $user = get_userdata($customer_id);
  if (!$user || empty($user->user_email)) {
    return null;
  }

  $date_paid = $order->get_date_paid();
  $date_str = $date_paid ? $date_paid->date('c') : $order->get_date_created()->date('c');

  return array(
    'order_id' => $order->get_id(),
    'wp_user_id' => $customer_id,
    'email' => $user->user_email, // The registered email
    'amount' => (float) $order->get_total(),
    'currency' => $order->get_currency(),
    'status' => $order->get_status(),
    'date' => $date_str,
    'source' => 'woocommerce_order'
  );
}

function artly_reminder_bridge_post_orders(array $payload): ?array
{
  $api_url = get_option(ARB_ENGINE_URL_OPTION);
  $api_secret = get_option(ARB_ENGINE_SECRET_OPTION);

  if (empty($api_url) || empty($api_secret)) {
    return null;
  }

  $response = wp_remote_post(
    $api_url,
    array(
      'headers' => array(
        'Content-Type' => 'application/json',
        'x-renewalflow-key' => $api_secret,
      ),
      'body' => wp_json_encode($payload),
      'timeout' => 30, // Increased timeout for batch orders
    )
  );

  if (is_wp_error($response)) {
    artly_reminder_bridge_log('Error syncing orders: ' . $response->get_error_message());
    return null;
  }

  $code = wp_remote_retrieve_response_code($response);
  $body = wp_remote_retrieve_body($response);

  if ($code >= 300) {
    artly_reminder_bridge_log('Sync failed with status ' . $code . ' body: ' . $body);
    return null;
  }

  return json_decode($body, true);
}

function artly_sync_orders_from_woo(): void
{
  // Ensure WC is loaded
  if (!function_exists('wc_get_orders')) {
    return;
  }

  $last_id = (int) get_option(ARB_LAST_ORDER_ID_OPTION, 0);
  $total_imported = 0;

  // Max 5 loops per cron/request to avoid timeouts
  $loops = 0;
  $max_loops = 5;

  while ($loops < $max_loops) {
    $orders = artly_reminder_bridge_fetch_orders_batch($last_id);

    if (empty($orders)) {
      break;
    }

    $payload = array();
    $batch_last_id = $last_id;

    foreach ($orders as $order) {
      $item = artly_reminder_bridge_build_order_payload($order);
      $batch_last_id = $order->get_id(); // Always advance cursor even if skipped (guest)

      if ($item) {
        $payload[] = $item;
      }
    }

    // If all were guests or invalid, just update cursor and continue
    if (empty($payload)) {
      $last_id = $batch_last_id;
      update_option(ARB_LAST_ORDER_ID_OPTION, $last_id);
      $loops++;
      continue;
    }

    $result = artly_reminder_bridge_post_orders($payload);
    if (null === $result) {
      return; // Stop on API error
    }

    $last_id = $batch_last_id;
    update_option(ARB_LAST_ORDER_ID_OPTION, $last_id);
    update_option(ARB_LAST_SYNC_TIME_OPTION, current_time('mysql', true));
    $total_imported += count($payload);
    $loops++;
  }

  if ($total_imported > 0) {
    artly_reminder_bridge_log(sprintf('Synced %d orders up to ID %d', $total_imported, $last_id));
  }
}

add_action('admin_menu', 'artly_reminder_bridge_admin_menu');
function artly_reminder_bridge_admin_menu(): void
{
  $page_hook = add_submenu_page(
    'woocommerce',
    __('RenewalFlow Sync', 'artly-reminder-bridge'),
    __('RenewalFlow Sync', 'artly-reminder-bridge'),
    'manage_woocommerce',
    'renewalflow-sync',
    'artly_reminder_bridge_render_admin_page'
  );
  add_action('admin_print_styles-' . $page_hook, 'artly_reminder_bridge_inject_css');
}

function artly_reminder_bridge_inject_css(): void
{
  ?>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    /* Admin Page Cleanup */
    .wrap.renewalflow-wrap {
      font-family: 'Inter', sans-serif;
      max-width: 800px;
      margin: 40px auto;
      color: #d4d4d8;
      /* zinc-300 */
    }

    .wrap.renewalflow-wrap h1 {
      color: #fff;
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }

    .wrap.renewalflow-wrap p.subtitle {
      color: #a1a1aa;
      /* zinc-400 */
      font-size: 1.1rem;
      margin-bottom: 2.5rem;
    }

    /* Glass Card Container */
    .rf-card {
      background: #18181b;
      /* zinc-900 */
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 2rem;
      box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
      margin-bottom: 20px;
      position: relative;
      overflow: hidden;
    }

    /* Input Styling */
    .rf-field {
      margin-bottom: 1.5rem;
    }

    .rf-label {
      display: block;
      margin-bottom: 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: #e4e4e7;
      /* zinc-200 */
    }

    input.rf-input[type="text"],
    input.rf-input[type="url"],
    input.rf-input[type="password"] {
      width: 100%;
      background-color: #09090b;
      /* zinc-950 */
      border: 1px solid #27272a;
      /* zinc-800 */
      color: white;
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      font-size: 0.95rem;
      outline: none;
      box-shadow: none;
      transition: all 0.2s;
    }

    input.rf-input:focus {
      border-color: #8b5cf6;
      /* violet-500 */
      box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
    }

    /* Button Styling */
    button.rf-btn {
      background: linear-gradient(135deg, #8b5cf6 0%, #22d3ee 100%);
      border: none;
      color: white;
      font-weight: 600;
      padding: 0.75rem 2rem;
      border-radius: 0.75rem;
      cursor: pointer;
      font-size: 1rem;
      transition: opacity 0.2s;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    button.rf-btn:hover {
      opacity: 0.9;
      color: white;
      /* WP override */
    }

    button.rf-btn-secondary {
      background: transparent;
      border: 1px solid #3f3f46;
      color: #a1a1aa;
    }

    button.rf-btn-secondary:hover {
      border-color: #e4e4e7;
      color: #e4e4e7;
    }

    /* Alerts */
    .rf-notice {
      background-color: rgba(16, 185, 129, 0.1);
      /* emerald-500/10 */
      border: 1px solid rgba(16, 185, 129, 0.2);
      color: #34d399;
      /* emerald-400 */
      padding: 1rem;
      border-radius: 0.75rem;
      margin-bottom: 2rem;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    /* Stats Grid */
    .rf-stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 2rem;
    }

    .rf-stat-box {
      background: rgba(255, 255, 255, 0.03);
      border-radius: 12px;
      padding: 1.5rem;
      text-align: center;
    }

    .rf-stat-label {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #71717a;
      /* zinc-500 */
      margin-bottom: 0.5rem;
    }

    .rf-stat-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: white;
    }
  </style>
  <?php
}

function artly_reminder_bridge_handle_post(): ?string
{
  if (!current_user_can('manage_woocommerce')) {
    return __('You do not have permission to manage this page.', 'artly-reminder-bridge');
  }

  if (!isset($_POST['artly_reminder_bridge_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['artly_reminder_bridge_nonce'])), 'artly_reminder_bridge_save')) {
    return __('Security check failed.', 'artly-reminder-bridge');
  }

  if (isset($_POST['artly_reminder_engine_url'])) {
    update_option(ARB_ENGINE_URL_OPTION, esc_url_raw(wp_unslash($_POST['artly_reminder_engine_url'])));
  }

  if (isset($_POST['artly_reminder_engine_secret'])) {
    update_option(ARB_ENGINE_SECRET_OPTION, sanitize_text_field(wp_unslash($_POST['artly_reminder_engine_secret'])));
  }

  if (isset($_POST['artly_sync_now'])) {
    artly_sync_orders_from_woo();
    return __('Manual sync triggered. Orders are being sent.', 'artly-reminder-bridge');
  }

  return __('Settings saved successfully.', 'artly-reminder-bridge');
}

function artly_reminder_bridge_render_admin_page(): void
{
  $message = null;
  if ('POST' === $_SERVER['REQUEST_METHOD']) {
    $message = artly_reminder_bridge_handle_post();
  }

  $last_id = (int) get_option(ARB_LAST_ORDER_ID_OPTION, 0);
  $last_sync = get_option(ARB_LAST_SYNC_TIME_OPTION);
  $api_url = get_option(ARB_ENGINE_URL_OPTION);
  $api_secret = get_option(ARB_ENGINE_SECRET_OPTION);
  ?>
  <div class="wrap renewalflow-wrap">
    <h1>RenewalFlow Sync</h1>
    <p class="subtitle">Sync WooCommerce orders to RenewalFlow.</p>

    <?php if ($message): ?>
      <div class="rf-notice">
        <span>✓</span>
        <?php echo esc_html($message); ?>
      </div>
    <?php endif; ?>

    <div class="rf-stats-grid">
      <div class="rf-stat-box">
        <div class="rf-stat-label">Last Synced Order ID</div>
        <div class="rf-stat-value">#<?php echo esc_html((string) $last_id); ?></div>
      </div>
      <div class="rf-stat-box">
        <div class="rf-stat-label">Last Sync Time (UTC)</div>
        <div class="rf-stat-value"><?php echo esc_html($last_sync ? date('H:i', strtotime($last_sync)) : '--:--'); ?>
        </div>
        <div style="font-size:0.8rem; color:#52525b; margin-top:5px;">
          <?php echo esc_html($last_sync ? date('M d, Y', strtotime($last_sync)) : 'Never'); ?></div>
      </div>
    </div>

    <form method="post">
      <?php wp_nonce_field('artly_reminder_bridge_save', 'artly_reminder_bridge_nonce'); ?>

      <div class="rf-card">
        <div class="rf-field">
          <label for="artly_reminder_engine_url" class="rf-label">API Endpoint URL</label>
          <input name="artly_reminder_engine_url" type="url" id="artly_reminder_engine_url" class="rf-input"
            value="<?php echo esc_attr($api_url); ?>" placeholder="https://..." required />
        </div>

        <div class="rf-field">
          <label for="artly_reminder_engine_secret" class="rf-label">Connection Secret Key</label>
          <input name="artly_reminder_engine_secret" type="password" id="artly_reminder_engine_secret" class="rf-input"
            value="<?php echo esc_attr($api_secret); ?>" placeholder="rf_live_..." required />
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:30px;">
          <button type="submit" name="submit" class="rf-btn">Save Configuration</button>
          <button type="submit" name="artly_sync_now" value="1" class="rf-btn rf-btn-secondary">Trigger Manual
            Sync</button>
        </div>
      </div>
    </form>

    <div style="text-align:center; color:#52525b; font-size:0.8rem; margin-top:30px;">
      &copy; <?php echo date('Y'); ?> RenewalFlow Inc. All rights reserved.
    </div>

  </div>
  <?php
}
