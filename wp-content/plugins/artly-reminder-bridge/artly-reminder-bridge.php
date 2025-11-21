<?php
/**
 * Plugin Name: Artly Reminder Bridge
 * Description: Syncs WooCommerce Points & Rewards and Subscriptions data into the Artly Reminder Engine with cron and manual sync.
 * Version: 1.0.0
 * Author: Artly
 */

if ( ! defined( 'ABSPATH' ) ) {
  exit;
}

const ARB_LAST_LOG_ID_OPTION    = '_artly_last_woo_points_log_id';
const ARB_LAST_SYNC_TIME_OPTION = '_artly_last_points_sync_time';
const ARB_ENGINE_URL_OPTION     = '_artly_reminder_engine_url';
const ARB_ENGINE_SECRET_OPTION  = '_artly_reminder_engine_secret';
const ARB_CRON_HOOK             = 'artly_points_sync_cron';
const ARB_LAST_SYNC_RESULT      = '_artly_last_sync_result';
const ARB_LAST_SYNC_ERROR       = '_artly_last_sync_error';
const ARB_SYNC_PROGRESS_OPTION  = '_artly_sync_progress';

register_activation_hook( __FILE__, 'artly_reminder_bridge_activate' );
function artly_reminder_bridge_activate(): void {
  if ( ! wp_next_scheduled( ARB_CRON_HOOK ) ) {
    wp_schedule_event( time(), 'hourly', ARB_CRON_HOOK );
  }

  add_option( ARB_LAST_LOG_ID_OPTION, 0 );
  add_option( ARB_LAST_SYNC_TIME_OPTION, null );
  add_option( ARB_ENGINE_URL_OPTION, 'https://renewalflow-production.up.railway.app' );
  add_option( ARB_ENGINE_SECRET_OPTION, '' );
}

add_action( ARB_CRON_HOOK, 'artly_sync_points_from_woo' );

function artly_reminder_bridge_get_points_table( \wpdb $wpdb ): string {
  return $wpdb->prefix . 'wc_points_rewards_user_points_log';
}

function artly_reminder_bridge_points_table_exists( \wpdb $wpdb ): bool {
  $table_name = artly_reminder_bridge_get_points_table( $wpdb );
  return (bool) $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table_name ) );
}

function artly_reminder_bridge_log( string $message ): void {
  if ( function_exists( 'wc_get_logger' ) ) {
    $logger = wc_get_logger();
    $logger->info( $message, array( 'source' => 'artly-reminder-bridge' ) );
  } else {
    error_log( '[artly-reminder-bridge] ' . $message );
  }
}

function artly_reminder_bridge_fetch_events_batch( \wpdb $wpdb, int $last_id ): array {
  $table_name = artly_reminder_bridge_get_points_table( $wpdb );
  $query      = $wpdb->prepare( "SELECT * FROM {$table_name} WHERE id > %d ORDER BY id ASC LIMIT 500", $last_id );

  return $wpdb->get_results( $query );
}

function artly_reminder_bridge_build_payload_item( $row ): ?array {
  if ( empty( $row->user_id ) ) {
    return null;
  }

  $user = get_userdata( (int) $row->user_id );
  if ( ! $user || empty( $user->user_email ) ) {
    return null;
  }

  $points_delta = (int) $row->points;
  $event_type   = $points_delta > 0 ? 'points_charging' : 'redeem';
  $source       = ( isset( $row->event ) && is_string( $row->event ) && str_contains( strtolower( $row->event ), 'subscription' ) ) ? 'subscription_renewal' : 'one_time_purchase';

  return array(
    'external_event_id' => (int) $row->id,
    'wp_user_id'        => (int) $row->user_id,
    'email'             => $user->user_email,
    'points_delta'      => $points_delta,
    'event_type'        => $event_type,
    'source'            => $source,
    'order_id'          => isset( $row->order_id ) ? (string) $row->order_id : null,
    'created_at'        => isset( $row->date ) ? gmdate( 'c', strtotime( (string) $row->date ) ) : gmdate( 'c' ),
  );
}

function artly_reminder_bridge_post_to_api( string $endpoint, array $payload ): ?array {
  $api_url    = get_option( ARB_ENGINE_URL_OPTION );
  $api_secret = get_option( ARB_ENGINE_SECRET_OPTION );

  if ( empty( $api_url ) || empty( $api_secret ) ) {
    $error_msg = 'API URL or Secret not configured. Please configure in WordPress admin → WooCommerce → Artly Reminder Sync.';
    artly_reminder_bridge_log( $error_msg );
    update_option( ARB_LAST_SYNC_ERROR, $error_msg );
    return null;
  }

  // Ensure URL doesn't have trailing slash and endpoint doesn't start with /
  $api_url = rtrim( $api_url, '/' );
  $endpoint = ltrim( $endpoint, '/' );
  $full_url = $api_url . '/' . $endpoint;
  
  artly_reminder_bridge_log( 'Sending request to: ' . $full_url );
  artly_reminder_bridge_log( 'Payload size: ' . count( $payload ) . ' items' );

  // Ensure header name is correct (Express normalizes to lowercase)
  $response = wp_remote_post(
    $full_url,
    array(
      'headers' => array(
        'Content-Type'   => 'application/json',
        'x-artly-secret' => trim( $api_secret ), // Trim any whitespace
      ),
      'body'    => wp_json_encode( $payload ),
      'timeout' => 60, // Increased timeout for large batches
    )
  );
  
  // Log the header being sent for debugging
  artly_reminder_bridge_log( 'Request headers: x-artly-secret=' . substr( $api_secret, 0, 20 ) . '...' );

  if ( is_wp_error( $response ) ) {
    $error_msg = 'Error syncing to ' . $endpoint . ': ' . $response->get_error_message();
    artly_reminder_bridge_log( $error_msg );
    update_option( ARB_LAST_SYNC_ERROR, $error_msg );
    return null;
  }

  $code = wp_remote_retrieve_response_code( $response );
  $body = wp_remote_retrieve_body( $response );

  if ( $code >= 300 ) {
    $error_msg = 'Sync to ' . $endpoint . ' failed with status ' . $code;
    if ( $code === 401 ) {
      $error_msg .= ' - Unauthorized. Please check your API key is correct and matches the one in your RenewalFlow dashboard.';
    }
    $error_msg .= ' Response: ' . $body;
    artly_reminder_bridge_log( $error_msg );
    update_option( ARB_LAST_SYNC_ERROR, $error_msg );
    return null;
  }

  // Clear error on success
  update_option( ARB_LAST_SYNC_ERROR, '' );
  return json_decode( $body, true );
}

function artly_reminder_bridge_post_events( array $events ): ?array {
  return artly_reminder_bridge_post_to_api( 'artly/sync/points-events', $events );
}

function artly_sync_points_from_woo(): array {
  global $wpdb;

  if ( ! artly_reminder_bridge_points_table_exists( $wpdb ) ) {
    $msg = 'Woo Points & Rewards table not found; skipping sync.';
    artly_reminder_bridge_log( $msg );
    update_option( ARB_LAST_SYNC_RESULT, array( 'type' => 'points', 'success' => false, 'message' => $msg, 'count' => 0 ) );
    delete_option( ARB_SYNC_PROGRESS_OPTION );
    return array( 'success' => false, 'message' => $msg, 'count' => 0 );
  }

  // Count total events to sync for progress tracking
  $total_count_query = $wpdb->prepare(
    "SELECT COUNT(*) FROM {$wpdb->prefix}wc_points_rewards_user_points_log WHERE id > %d",
    (int) get_option( ARB_LAST_LOG_ID_OPTION, 0 )
  );
  $total_to_sync = (int) $wpdb->get_var( $total_count_query );

  // Initialize progress
  update_option( ARB_SYNC_PROGRESS_OPTION, array(
    'type' => 'points',
    'status' => 'running',
    'processed' => 0,
    'total' => $total_to_sync,
    'imported' => 0,
    'message' => 'Starting sync...',
  ) );

  $last_id        = (int) get_option( ARB_LAST_LOG_ID_OPTION, 0 );
  $total_imported = 0;
  $total_processed = 0;
  $batch_number = 0;

  while ( true ) {
    $rows = artly_reminder_bridge_fetch_events_batch( $wpdb, $last_id );

    if ( empty( $rows ) ) {
      break;
    }

    $batch_number++;
    $payload = array();

    foreach ( $rows as $row ) {
      $item = artly_reminder_bridge_build_payload_item( $row );
      if ( $item ) {
        $payload[] = $item;
      }
    }

    if ( empty( $payload ) ) {
      $last_id = (int) end( $rows )->id;
      update_option( ARB_LAST_LOG_ID_OPTION, $last_id );
      // Update progress
      update_option( ARB_SYNC_PROGRESS_OPTION, array(
        'type' => 'points',
        'status' => 'running',
        'processed' => $total_processed,
        'total' => $total_to_sync,
        'imported' => $total_imported,
        'message' => sprintf( 'Processing batch %d...', $batch_number ),
      ) );
      continue;
    }

    // Update progress before sending batch
    update_option( ARB_SYNC_PROGRESS_OPTION, array(
      'type' => 'points',
      'status' => 'running',
      'processed' => $total_processed,
      'total' => $total_to_sync,
      'imported' => $total_imported,
      'message' => sprintf( 'Sending batch %d (%d events)...', $batch_number, count( $payload ) ),
    ) );

    $result = artly_reminder_bridge_post_events( $payload );
    if ( null === $result ) {
      $error = get_option( ARB_LAST_SYNC_ERROR, 'Unknown error during points sync' );
      update_option( ARB_LAST_SYNC_RESULT, array( 'type' => 'points', 'success' => false, 'message' => $error, 'count' => $total_imported ) );
      update_option( ARB_SYNC_PROGRESS_OPTION, array(
        'type' => 'points',
        'status' => 'error',
        'processed' => $total_processed,
        'total' => $total_to_sync,
        'imported' => $total_imported,
        'message' => $error,
      ) );
      return array( 'success' => false, 'message' => $error, 'count' => $total_imported );
    }

    $last_id = (int) end( $rows )->id;
    update_option( ARB_LAST_LOG_ID_OPTION, $last_id );
    update_option( ARB_LAST_SYNC_TIME_OPTION, current_time( 'mysql', true ) );
    $batch_imported = (int) ( $result['imported'] ?? count( $payload ) );
    $total_imported += $batch_imported;
    $total_processed += count( $payload );

    // Update progress after batch
    update_option( ARB_SYNC_PROGRESS_OPTION, array(
      'type' => 'points',
      'status' => 'running',
      'processed' => $total_processed,
      'total' => $total_to_sync,
      'imported' => $total_imported,
      'message' => sprintf( 'Processed batch %d: %d imported', $batch_number, $batch_imported ),
    ) );
  }

  // Final progress update
  if ( $total_imported > 0 ) {
    $msg = sprintf( 'Successfully synced %d points events (up to ID %d)', $total_imported, $last_id );
    artly_reminder_bridge_log( $msg );
    update_option( ARB_LAST_SYNC_RESULT, array( 'type' => 'points', 'success' => true, 'message' => $msg, 'count' => $total_imported, 'total' => $total_processed ) );
    update_option( ARB_SYNC_PROGRESS_OPTION, array(
      'type' => 'points',
      'status' => 'completed',
      'processed' => $total_processed,
      'total' => $total_to_sync,
      'imported' => $total_imported,
      'message' => $msg,
    ) );
    return array( 'success' => true, 'message' => $msg, 'count' => $total_imported, 'total' => $total_processed );
  }
  
  $msg = 'No new points events to sync.';
  update_option( ARB_LAST_SYNC_RESULT, array( 'type' => 'points', 'success' => true, 'message' => $msg, 'count' => 0 ) );
  update_option( ARB_SYNC_PROGRESS_OPTION, array(
    'type' => 'points',
    'status' => 'completed',
    'processed' => 0,
    'total' => 0,
    'imported' => 0,
    'message' => $msg,
  ) );
  return array( 'success' => true, 'message' => $msg, 'count' => 0 );
}

function artly_sync_users_from_woo(): array {
  // First, count total users to determine batch size
  $total_user_count = count_users();
  $total_users = (int) $total_user_count['total_users'];
  
  artly_reminder_bridge_log( sprintf( 'Starting user sync. Total users: %d', $total_users ) );
  
  if ( $total_users === 0 ) {
    $msg = 'No users to sync.';
    artly_reminder_bridge_log( $msg );
    update_option( ARB_LAST_SYNC_RESULT, array( 'type' => 'users', 'success' => false, 'message' => $msg, 'count' => 0 ) );
    return array( 'success' => false, 'message' => $msg, 'count' => 0 );
  }
  
  // Calculate batch size based on total users:
  // - 1-50 users: process 10 at a time
  // - 51-200 users: process 20 at a time
  // - 201-500 users: process 30 at a time
  // - 501-1000 users: process 40 at a time
  // - 1000+ users: process 50 at a time (max)
  if ( $total_users <= 50 ) {
    $batch_size = 10;
  } elseif ( $total_users <= 200 ) {
    $batch_size = 20;
  } elseif ( $total_users <= 500 ) {
    $batch_size = 30;
  } elseif ( $total_users <= 1000 ) {
    $batch_size = 40;
  } else {
    $batch_size = 50; // Max batch size to prevent timeouts
  }
  
  artly_reminder_bridge_log( sprintf( 'Using batch size: %d (total users: %d)', $batch_size, $total_users ) );
  
  $offset = 0;
  $total_upserted = 0;
  $total_processed = 0;
  $batch_number = 0;

  while ( true ) {
    $batch_number++;
    
    // Fetch users in batches
    $users = get_users( array( 
      'fields' => array( 'ID', 'user_email' ),
      'number' => $batch_size,
      'offset' => $offset,
    ) );

    if ( empty( $users ) ) {
      break; // No more users
    }

    $payload = array();

    foreach ( $users as $user ) {
      $user_meta = get_user_meta( $user->ID );
      $payload[] = array(
        'wp_user_id' => (int) $user->ID,
        'email'      => $user->user_email,
        'phone'      => isset( $user_meta['billing_phone'][0] ) ? $user_meta['billing_phone'][0] : null,
        'whatsapp'   => isset( $user_meta['whatsapp'][0] ) ? $user_meta['whatsapp'][0] : null,
        'locale'     => get_user_locale( $user->ID ),
        'timezone'   => get_user_meta( $user->ID, 'timezone_string', true ) ?: null,
      );
    }

    if ( empty( $payload ) ) {
      $offset += $batch_size;
      continue;
    }

    // Log batch progress
    $progress = $total_users > 0 ? round( ( $total_processed / $total_users ) * 100, 1 ) : 0;
    artly_reminder_bridge_log( sprintf( 
      'Processing batch %d: %d users (Progress: %d/%d, %.1f%%)', 
      $batch_number, 
      count( $payload ), 
      $total_processed, 
      $total_users, 
      $progress 
    ) );

    $result = artly_reminder_bridge_post_to_api( 'artly/sync/users', $payload );
    if ( null === $result ) {
      $error = get_option( ARB_LAST_SYNC_ERROR, 'Unknown error' );
      $msg = sprintf( 'Failed to sync users batch %d (offset %d, %d users). %s', $batch_number, $offset, count( $payload ), $error );
      artly_reminder_bridge_log( $msg );
      update_option( ARB_LAST_SYNC_RESULT, array( 
        'type' => 'users', 
        'success' => false, 
        'message' => $msg, 
        'count' => $total_upserted, 
        'total' => $total_processed,
        'progress' => $progress 
      ) );
      return array( 'success' => false, 'message' => $msg, 'count' => $total_upserted, 'total' => $total_processed );
    }

    $batch_upserted = (int) ( $result['upserted'] ?? count( $payload ) );
    $total_upserted += $batch_upserted;
    $total_processed += count( $payload );
    
    artly_reminder_bridge_log( sprintf( 
      'Batch %d completed: %d users synced (Total: %d/%d, %.1f%%)', 
      $batch_number, 
      $batch_upserted, 
      $total_processed, 
      $total_users, 
      round( ( $total_processed / $total_users ) * 100, 1 ) 
    ) );

    $offset += $batch_size;
    
    // If we got fewer users than the batch size, we're done
    if ( count( $users ) < $batch_size ) {
      break;
    }
    
    // Add a small delay between batches to prevent overwhelming the server
    // Only delay if we have more batches to process
    if ( $offset < $total_users ) {
      usleep( 500000 ); // 0.5 second delay between batches
    }
  }

  if ( $total_upserted > 0 ) {
    $msg = sprintf( 'Successfully synced %d of %d users', $total_upserted, $total_users );
    artly_reminder_bridge_log( $msg );
    update_option( ARB_LAST_SYNC_RESULT, array( 
      'type' => 'users', 
      'success' => true, 
      'message' => $msg, 
      'count' => $total_upserted, 
      'total' => $total_users,
      'batches' => $batch_number 
    ) );
    return array( 'success' => true, 'message' => $msg, 'count' => $total_upserted, 'total' => $total_users, 'batches' => $batch_number );
  }
  
  $msg = 'No users were synced.';
  artly_reminder_bridge_log( $msg );
  update_option( ARB_LAST_SYNC_RESULT, array( 'type' => 'users', 'success' => false, 'message' => $msg, 'count' => 0 ) );
  return array( 'success' => false, 'message' => $msg, 'count' => 0 );
}

function artly_sync_charges_from_woo(): array {
  if ( ! class_exists( 'WooCommerce' ) ) {
    $msg = 'WooCommerce not found; skipping charge sync.';
    artly_reminder_bridge_log( $msg );
    update_option( ARB_LAST_SYNC_RESULT, array( 'type' => 'charges', 'success' => false, 'message' => $msg, 'count' => 0 ) );
    return array( 'success' => false, 'message' => $msg, 'count' => 0 );
  }

  $orders = wc_get_orders(
    array(
      'limit'  => 1000,
      'status' => array( 'processing', 'completed', 'on-hold' ),
      'orderby' => 'date',
      'order'   => 'DESC',
    )
  );

  $payload = array();

  foreach ( $orders as $order ) {
    $user_id = $order->get_user_id();
    if ( ! $user_id ) {
      continue;
    }
    $user = get_userdata( $user_id );
    $payload[] = array(
      'external_charge_id' => (string) $order->get_id(),
      'wp_user_id'         => $user_id > 0 ? $user_id : null,
      'email'              => $order->get_billing_email(),
      'order_id'           => (string) $order->get_id(),
      'amount'             => (float) $order->get_total(),
      'currency'           => $order->get_currency(),
      'status'             => $order->get_status(),
      'payment_method'     => $order->get_payment_method(),
      'created_at'         => gmdate( 'c', $order->get_date_created()->getTimestamp() ),
    );
  }

  if ( empty( $payload ) ) {
    $msg = 'No charges to sync.';
    artly_reminder_bridge_log( $msg );
    update_option( ARB_LAST_SYNC_RESULT, array( 'type' => 'charges', 'success' => false, 'message' => $msg, 'count' => 0 ) );
    return array( 'success' => false, 'message' => $msg, 'count' => 0 );
  }

  $result = artly_reminder_bridge_post_to_api( 'artly/sync/charges', $payload );
  if ( null !== $result ) {
    $upserted = (int) ( $result['upserted'] ?? count( $payload ) );
    $msg = sprintf( 'Successfully synced %d charges', $upserted );
    artly_reminder_bridge_log( $msg );
    update_option( ARB_LAST_SYNC_RESULT, array( 'type' => 'charges', 'success' => true, 'message' => $msg, 'count' => $upserted, 'total' => count( $payload ) ) );
    return array( 'success' => true, 'message' => $msg, 'count' => $upserted, 'total' => count( $payload ) );
  }
  
  $error = get_option( ARB_LAST_SYNC_ERROR, 'Unknown error' );
  update_option( ARB_LAST_SYNC_RESULT, array( 'type' => 'charges', 'success' => false, 'message' => $error, 'count' => 0 ) );
  return array( 'success' => false, 'message' => $error, 'count' => 0 );
}

add_action( 'admin_menu', 'artly_reminder_bridge_admin_menu' );
add_action( 'wp_ajax_artly_get_sync_progress', 'artly_get_sync_progress' );
function artly_get_sync_progress() {
  check_ajax_referer( 'artly_sync_progress', '_wpnonce' );
  $progress = get_option( ARB_SYNC_PROGRESS_OPTION, null );
  if ( $progress ) {
    wp_send_json_success( $progress );
  } else {
    wp_send_json_success( array( 'status' => 'idle' ) );
  }
}
function artly_reminder_bridge_admin_menu(): void {
  add_submenu_page(
    'woocommerce',
    __( 'Artly Reminder Sync', 'artly-reminder-bridge' ),
    __( 'Artly Reminder Sync', 'artly-reminder-bridge' ),
    'manage_woocommerce',
    'artly-reminder-sync',
    'artly_reminder_bridge_render_admin_page'
  );
}

function artly_reminder_bridge_handle_post(): ?string {
  if ( ! current_user_can( 'manage_woocommerce' ) ) {
    return __( 'You do not have permission to manage this page.', 'artly-reminder-bridge' );
  }

  if ( ! isset( $_POST['artly_reminder_bridge_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['artly_reminder_bridge_nonce'] ) ), 'artly_reminder_bridge_save' ) ) {
    return __( 'Security check failed.', 'artly-reminder-bridge' );
  }

  if ( isset( $_POST['artly_reminder_engine_url'] ) ) {
    update_option( ARB_ENGINE_URL_OPTION, esc_url_raw( wp_unslash( $_POST['artly_reminder_engine_url'] ) ) );
  }

  if ( isset( $_POST['artly_reminder_engine_secret'] ) ) {
    update_option( ARB_ENGINE_SECRET_OPTION, sanitize_text_field( wp_unslash( $_POST['artly_reminder_engine_secret'] ) ) );
  }

  if ( isset( $_POST['artly_test_connection'] ) ) {
    $api_url    = get_option( ARB_ENGINE_URL_OPTION );
    $api_secret = get_option( ARB_ENGINE_SECRET_OPTION );
    
    if ( empty( $api_url ) || empty( $api_secret ) ) {
      return '<span style="color: red;">❌ Error: API URL or Secret not configured.</span>';
    }
    
    $api_url = rtrim( $api_url, '/' );
    $test_url = $api_url . '/artly/sync/users';
    
    $response = wp_remote_post(
      $test_url,
      array(
        'headers' => array(
          'Content-Type'   => 'application/json',
          'x-artly-secret' => $api_secret,
        ),
        'body'    => wp_json_encode( array() ),
        'timeout' => 10,
      )
    );
    
    if ( is_wp_error( $response ) ) {
      return '<span style="color: red;">❌ Connection failed: ' . esc_html( $response->get_error_message() ) . '</span>';
    }
    
    $code = wp_remote_retrieve_response_code( $response );
    if ( $code === 401 ) {
      return '<span style="color: red;">❌ Unauthorized: Invalid API key. Please check your API key matches the one in your RenewalFlow dashboard.</span>';
    } elseif ( $code >= 300 ) {
      $body = wp_remote_retrieve_body( $response );
      return '<span style="color: orange;">⚠️ Connection test returned status ' . $code . ': ' . esc_html( substr( $body, 0, 100 ) ) . '</span>';
    }
    
    return '<span style="color: green;">✅ Connection successful! API key is valid.</span>';
  }

  if ( isset( $_POST['artly_sync_users'] ) ) {
    $result = artly_sync_users_from_woo();
    if ( $result['success'] ) {
      return '<span style="color: green;">✅ ' . esc_html( $result['message'] ) . ' (' . $result['count'] . ' of ' . $result['total'] . ' users)</span>';
    }
    return '<span style="color: red;">❌ ' . esc_html( $result['message'] ) . '</span>';
  }

  if ( isset( $_POST['artly_sync_points'] ) ) {
    $result = artly_sync_points_from_woo();
    if ( $result['success'] ) {
      $msg = $result['message'];
      if ( $result['count'] > 0 && isset( $result['total'] ) ) {
        $msg .= ' (' . $result['count'] . ' of ' . $result['total'] . ' events)';
      }
      return '<span style="color: green;">✅ ' . esc_html( $msg ) . '</span>';
    }
    return '<span style="color: red;">❌ ' . esc_html( $result['message'] ) . '</span>';
  }

  if ( isset( $_POST['artly_sync_charges'] ) ) {
    $result = artly_sync_charges_from_woo();
    if ( $result['success'] ) {
      return '<span style="color: green;">✅ ' . esc_html( $result['message'] ) . ' (' . $result['count'] . ' of ' . $result['total'] . ' charges)</span>';
    }
    return '<span style="color: red;">❌ ' . esc_html( $result['message'] ) . '</span>';
  }

  return __( 'Settings saved.', 'artly-reminder-bridge' );
}

function artly_reminder_bridge_render_admin_page(): void {
  $message = null;
  if ( 'POST' === $_SERVER['REQUEST_METHOD'] ) {
    $message = artly_reminder_bridge_handle_post();
  }

  $last_id    = (int) get_option( ARB_LAST_LOG_ID_OPTION, 0 );
  $last_sync  = get_option( ARB_LAST_SYNC_TIME_OPTION );
  $api_url    = get_option( ARB_ENGINE_URL_OPTION );
  $api_secret = get_option( ARB_ENGINE_SECRET_OPTION );
  $user_count = count_users();
  $total_users = (int) $user_count['total_users'];
  
  // Calculate expected batch size for display
  $expected_batch_size = 50;
  if ( $total_users <= 50 ) {
    $expected_batch_size = 10;
  } elseif ( $total_users <= 200 ) {
    $expected_batch_size = 20;
  } elseif ( $total_users <= 500 ) {
    $expected_batch_size = 30;
  } elseif ( $total_users <= 1000 ) {
    $expected_batch_size = 40;
  }
  $expected_batches = $total_users > 0 ? ceil( $total_users / $expected_batch_size ) : 0;
  ?>
  <div class="wrap">
    <h1><?php esc_html_e( 'Artly Reminder Sync', 'artly-reminder-bridge' ); ?></h1>
    <?php if ( $message ) : ?>
      <div class="notice notice-success"><p><?php echo wp_kses_post( $message ); ?></p></div>
    <?php endif; ?>
    <table class="widefat" style="max-width: 700px; margin-top: 10px;">
      <tbody>
        <tr>
          <th><?php esc_html_e( 'WordPress Users', 'artly-reminder-bridge' ); ?></th>
          <td><strong><?php echo esc_html( $total_users ); ?></strong> total users</td>
        </tr>
        <tr>
          <th><?php esc_html_e( 'Sync Strategy', 'artly-reminder-bridge' ); ?></th>
          <td>
            <?php if ( $total_users > 0 ) : ?>
              Batch size: <strong><?php echo esc_html( $expected_batch_size ); ?></strong> users per batch<br>
              Expected batches: <strong><?php echo esc_html( $expected_batches ); ?></strong>
            <?php else : ?>
              No users to sync
            <?php endif; ?>
          </td>
        </tr>
        <tr>
          <th><?php esc_html_e( 'Last Woo Points Log ID', 'artly-reminder-bridge' ); ?></th>
          <td><?php echo esc_html( (string) $last_id ); ?></td>
        </tr>
        <tr>
          <th><?php esc_html_e( 'Last Sync Time (UTC)', 'artly-reminder-bridge' ); ?></th>
          <td><?php echo esc_html( $last_sync ? $last_sync : __( 'Never', 'artly-reminder-bridge' ) ); ?></td>
        </tr>
        <tr>
          <th><?php esc_html_e( 'Connection Status', 'artly-reminder-bridge' ); ?></th>
          <td>
            <?php if ( ! empty( $api_url ) && ! empty( $api_secret ) ) : ?>
              <span style="color: green;">✅ Configured</span>
            <?php else : ?>
              <span style="color: red;">❌ Not configured</span>
            <?php endif; ?>
          </td>
        </tr>
      </tbody>
    </table>
    <form method="post" style="max-width: 700px; margin-top: 20px;">
      <?php wp_nonce_field( 'artly_reminder_bridge_save', 'artly_reminder_bridge_nonce' ); ?>
      <div class="notice notice-info" style="max-width: 700px; margin: 20px 0;">
        <p><strong><?php esc_html_e( 'How to get your API key:', 'artly-reminder-bridge' ); ?></strong></p>
        <ol>
          <li><?php esc_html_e( 'Log in to your RenewalFlow dashboard at', 'artly-reminder-bridge' ); ?> <a href="https://renewalflow.pages.dev" target="_blank">https://renewalflow.pages.dev</a></li>
          <li><?php esc_html_e( 'Go to the "Integrations" tab', 'artly-reminder-bridge' ); ?></li>
          <li><?php esc_html_e( 'Add your website URL and click "Connect Website"', 'artly-reminder-bridge' ); ?></li>
          <li><?php esc_html_e( 'Copy the generated API key and paste it below', 'artly-reminder-bridge' ); ?></li>
        </ol>
      </div>
      <table class="form-table">
        <tr>
          <th scope="row"><label for="artly_reminder_engine_url"><?php esc_html_e( 'RenewalFlow API Base URL', 'artly-reminder-bridge' ); ?></label></th>
          <td>
            <input name="artly_reminder_engine_url" type="url" id="artly_reminder_engine_url" class="regular-text" value="<?php echo esc_attr( $api_url ); ?>" placeholder="https://renewalflow-production.up.railway.app" required />
            <p class="description"><?php esc_html_e( 'The base URL of your RenewalFlow backend (without /artly/sync/). Example: https://renewalflow-production.up.railway.app', 'artly-reminder-bridge' ); ?></p>
          </td>
        </tr>
        <tr>
          <th scope="row"><label for="artly_reminder_engine_secret"><?php esc_html_e( 'API Key', 'artly-reminder-bridge' ); ?></label></th>
          <td>
            <input name="artly_reminder_engine_secret" type="text" id="artly_reminder_engine_secret" class="regular-text code" value="<?php echo esc_attr( $api_secret ); ?>" placeholder="artly_workspaceId_..." required />
            <p class="description"><?php esc_html_e( 'Copy this from your RenewalFlow dashboard → Integrations tab. It should start with "artly_"', 'artly-reminder-bridge' ); ?></p>
          </td>
        </tr>
      </table>
      <p class="submit">
        <button type="submit" name="submit" class="button button-primary"><?php esc_html_e( 'Save settings', 'artly-reminder-bridge' ); ?></button>
        <?php if ( ! empty( $api_url ) && ! empty( $api_secret ) ) : ?>
          <button type="submit" name="artly_test_connection" value="1" class="button"><?php esc_html_e( 'Test Connection', 'artly-reminder-bridge' ); ?></button>
        <?php endif; ?>
      </p>
    </form>
    <div style="max-width: 700px; margin-top: 20px;">
      <h2><?php esc_html_e( 'Manual Sync', 'artly-reminder-bridge' ); ?></h2>
      <p><?php esc_html_e( 'Use these buttons to manually sync data from WooCommerce to the Reminder Engine:', 'artly-reminder-bridge' ); ?></p>
      <form method="post" style="margin-top: 10px;">
        <?php wp_nonce_field( 'artly_reminder_bridge_save', 'artly_reminder_bridge_nonce' ); ?>
        <p>
          <button type="submit" name="artly_sync_users" value="1" class="button button-secondary"><?php esc_html_e( 'Sync Users', 'artly-reminder-bridge' ); ?></button>
          <span class="description">
            <?php esc_html_e( 'Sync all WordPress users to the Reminder Engine', 'artly-reminder-bridge' ); ?> 
            (<?php echo esc_html( $total_users ); ?> users, ~<?php echo esc_html( $expected_batches ); ?> batches)
            <?php if ( $total_users > 100 ) : ?>
              <br><em style="color: #666;"><?php esc_html_e( 'Note: Large syncs are processed in batches to prevent timeouts.', 'artly-reminder-bridge' ); ?></em>
            <?php endif; ?>
          </span>
        </p>
        <p>
          <button type="submit" name="artly_sync_points" value="1" class="button button-secondary" id="artly-sync-points-btn"><?php esc_html_e( 'Sync Points & Points Logs', 'artly-reminder-bridge' ); ?></button>
          <span class="description"><?php esc_html_e( 'Sync points events and logs from WooCommerce Points & Rewards', 'artly-reminder-bridge' ); ?></span>
        </p>
        <div id="artly-sync-progress" style="display: none; margin-top: 10px; padding: 10px; background: #f0f0f0; border-left: 4px solid #2271b1; max-width: 700px;">
          <p style="margin: 0 0 5px 0;"><strong><?php esc_html_e( 'Sync Progress', 'artly-reminder-bridge' ); ?>:</strong></p>
          <div id="artly-progress-message" style="margin-bottom: 5px;"></div>
          <div style="background: #fff; border: 1px solid #ddd; border-radius: 3px; height: 20px; overflow: hidden;">
            <div id="artly-progress-bar" style="background: #2271b1; height: 100%; width: 0%; transition: width 0.3s;"></div>
          </div>
          <p id="artly-progress-stats" style="margin: 5px 0 0 0; font-size: 12px; color: #666;"></p>
        </div>
        <p>
          <button type="submit" name="artly_sync_charges" value="1" class="button button-secondary"><?php esc_html_e( 'Sync Charges', 'artly-reminder-bridge' ); ?></button>
          <span class="description"><?php esc_html_e( 'Sync WooCommerce orders/charges to the Reminder Engine', 'artly-reminder-bridge' ); ?></span>
        </p>
      </form>
    </div>
  </div>
  <script>
  (function() {
    const syncBtn = document.getElementById('artly-sync-points-btn');
    const progressDiv = document.getElementById('artly-sync-progress');
    const progressMessage = document.getElementById('artly-progress-message');
    const progressBar = document.getElementById('artly-progress-bar');
    const progressStats = document.getElementById('artly-progress-stats');
    let progressInterval = null;

    function updateProgress() {
      fetch(ajaxurl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          action: 'artly_get_sync_progress',
          _wpnonce: '<?php echo wp_create_nonce( 'artly_sync_progress' ); ?>',
        }),
      })
      .then(response => response.json())
      .then(data => {
        if (data.success && data.data) {
          const progress = data.data;
          
          if (progress.status === 'running') {
            progressDiv.style.display = 'block';
            progressMessage.textContent = progress.message || 'Syncing...';
            
            const percentage = progress.total > 0 
              ? Math.round((progress.processed / progress.total) * 100) 
              : 0;
            progressBar.style.width = percentage + '%';
            
            progressStats.textContent = `Processed: ${progress.processed} / ${progress.total} | Imported: ${progress.imported}`;
            
            // Continue polling
            setTimeout(updateProgress, 1000);
          } else if (progress.status === 'completed') {
            progressDiv.style.display = 'block';
            progressMessage.textContent = progress.message || 'Sync completed!';
            progressBar.style.width = '100%';
            progressBar.style.background = '#46b450';
            progressStats.textContent = `Total processed: ${progress.processed} | Total imported: ${progress.imported}`;
            
            if (syncBtn) {
              syncBtn.disabled = false;
              syncBtn.textContent = '<?php esc_html_e( 'Sync Points & Points Logs', 'artly-reminder-bridge' ); ?>';
            }
            
            // Clear progress after 5 seconds
            setTimeout(() => {
              progressDiv.style.display = 'none';
            }, 5000);
          } else if (progress.status === 'error') {
            progressDiv.style.display = 'block';
            progressMessage.textContent = progress.message || 'Sync failed!';
            progressBar.style.background = '#dc3232';
            progressStats.textContent = `Processed: ${progress.processed} / ${progress.total}`;
            
            if (syncBtn) {
              syncBtn.disabled = false;
              syncBtn.textContent = '<?php esc_html_e( 'Sync Points & Points Logs', 'artly-reminder-bridge' ); ?>';
            }
          } else {
            // No active sync, stop polling
            if (syncBtn) {
              syncBtn.disabled = false;
            }
          }
        } else {
          // No progress data, stop polling
          if (syncBtn) {
            syncBtn.disabled = false;
          }
        }
      })
      .catch(error => {
        console.error('Error fetching progress:', error);
        if (syncBtn) {
          syncBtn.disabled = false;
        }
      });
    }

    if (syncBtn) {
      syncBtn.addEventListener('click', function() {
        this.disabled = true;
        this.textContent = '<?php esc_html_e( 'Syncing...', 'artly-reminder-bridge' ); ?>';
        progressDiv.style.display = 'block';
        progressMessage.textContent = 'Starting sync...';
        progressBar.style.width = '0%';
        progressBar.style.background = '#2271b1';
        progressStats.textContent = '';
        
        // Start polling after a short delay
        setTimeout(updateProgress, 500);
      });
    }

    // Check for existing sync on page load
    updateProgress();
  })();
  </script>
  <?php
}
