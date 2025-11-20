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

register_activation_hook( __FILE__, 'artly_reminder_bridge_activate' );
function artly_reminder_bridge_activate(): void {
  if ( ! wp_next_scheduled( ARB_CRON_HOOK ) ) {
    wp_schedule_event( time(), 'hourly', ARB_CRON_HOOK );
  }

  add_option( ARB_LAST_LOG_ID_OPTION, 0 );
  add_option( ARB_LAST_SYNC_TIME_OPTION, null );
  add_option( ARB_ENGINE_URL_OPTION, 'https://reminder-engine.example.com/artly/sync/points-events' );
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
    return null;
  }

  // Ensure URL ends with / and endpoint doesn't start with /
  $api_url = rtrim( $api_url, '/' );
  $endpoint = ltrim( $endpoint, '/' );
  $full_url = $api_url . '/' . $endpoint;

  $response = wp_remote_post(
    $full_url,
    array(
      'headers' => array(
        'Content-Type'   => 'application/json',
        'x-artly-secret' => $api_secret,
      ),
      'body'    => wp_json_encode( $payload ),
      'timeout' => 30,
    )
  );

  if ( is_wp_error( $response ) ) {
    artly_reminder_bridge_log( 'Error syncing to ' . $endpoint . ': ' . $response->get_error_message() );
    return null;
  }

  $code = wp_remote_retrieve_response_code( $response );
  $body = wp_remote_retrieve_body( $response );

  if ( $code >= 300 ) {
    artly_reminder_bridge_log( 'Sync to ' . $endpoint . ' failed with status ' . $code . ' body: ' . $body );
    return null;
  }

  return json_decode( $body, true );
}

function artly_reminder_bridge_post_events( array $events ): ?array {
  return artly_reminder_bridge_post_to_api( 'artly/sync/points-events', $events );
}

function artly_sync_points_from_woo(): void {
  global $wpdb;

  if ( ! artly_reminder_bridge_points_table_exists( $wpdb ) ) {
    artly_reminder_bridge_log( 'Woo Points & Rewards table not found; skipping sync.' );
    return;
  }

  $last_id        = (int) get_option( ARB_LAST_LOG_ID_OPTION, 0 );
  $total_imported = 0;

  while ( true ) {
    $rows = artly_reminder_bridge_fetch_events_batch( $wpdb, $last_id );

    if ( empty( $rows ) ) {
      break;
    }

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
      continue;
    }

    $result = artly_reminder_bridge_post_events( $payload );
    if ( null === $result ) {
      return;
    }

    $last_id = (int) end( $rows )->id;
    update_option( ARB_LAST_LOG_ID_OPTION, $last_id );
    update_option( ARB_LAST_SYNC_TIME_OPTION, current_time( 'mysql', true ) );
    $total_imported += (int) ( $result['imported'] ?? count( $payload ) );
  }

  if ( $total_imported > 0 ) {
    artly_reminder_bridge_log( sprintf( 'Synced %d points events up to ID %d', $total_imported, $last_id ) );
  }
}

function artly_sync_users_from_woo(): void {
  $users = get_users( array( 'fields' => array( 'ID', 'user_email' ) ) );
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
    artly_reminder_bridge_log( 'No users to sync.' );
    return;
  }

  $result = artly_reminder_bridge_post_to_api( 'artly/sync/users', $payload );
  if ( null !== $result ) {
    $upserted = (int) ( $result['upserted'] ?? count( $payload ) );
    artly_reminder_bridge_log( sprintf( 'Synced %d users', $upserted ) );
  }
}

function artly_sync_charges_from_woo(): void {
  if ( ! class_exists( 'WooCommerce' ) ) {
    artly_reminder_bridge_log( 'WooCommerce not found; skipping charge sync.' );
    return;
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
    artly_reminder_bridge_log( 'No charges to sync.' );
    return;
  }

  $result = artly_reminder_bridge_post_to_api( 'artly/sync/charges', $payload );
  if ( null !== $result ) {
    $upserted = (int) ( $result['upserted'] ?? count( $payload ) );
    artly_reminder_bridge_log( sprintf( 'Synced %d charges', $upserted ) );
  }
}

add_action( 'admin_menu', 'artly_reminder_bridge_admin_menu' );
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

  if ( isset( $_POST['artly_sync_points'] ) ) {
    artly_sync_points_from_woo();
    return __( 'Points sync triggered.', 'artly-reminder-bridge' );
  }

  if ( isset( $_POST['artly_sync_users'] ) ) {
    artly_sync_users_from_woo();
    return __( 'Users sync triggered.', 'artly-reminder-bridge' );
  }

  if ( isset( $_POST['artly_sync_charges'] ) ) {
    artly_sync_charges_from_woo();
    return __( 'Charges sync triggered.', 'artly-reminder-bridge' );
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
  ?>
  <div class="wrap">
    <h1><?php esc_html_e( 'Artly Reminder Sync', 'artly-reminder-bridge' ); ?></h1>
    <?php if ( $message ) : ?>
      <div class="notice notice-success"><p><?php echo esc_html( $message ); ?></p></div>
    <?php endif; ?>
    <table class="widefat" style="max-width: 700px; margin-top: 10px;">
      <tbody>
        <tr>
          <th><?php esc_html_e( 'Last Woo Points Log ID', 'artly-reminder-bridge' ); ?></th>
          <td><?php echo esc_html( (string) $last_id ); ?></td>
        </tr>
        <tr>
          <th><?php esc_html_e( 'Last Sync Time (UTC)', 'artly-reminder-bridge' ); ?></th>
          <td><?php echo esc_html( $last_sync ? $last_sync : __( 'Never', 'artly-reminder-bridge' ) ); ?></td>
        </tr>
      </tbody>
    </table>
    <form method="post" style="max-width: 700px; margin-top: 20px;">
      <?php wp_nonce_field( 'artly_reminder_bridge_save', 'artly_reminder_bridge_nonce' ); ?>
      <table class="form-table">
        <tr>
          <th scope="row"><label for="artly_reminder_engine_url"><?php esc_html_e( 'Reminder Engine URL', 'artly-reminder-bridge' ); ?></label></th>
          <td>
            <input name="artly_reminder_engine_url" type="url" id="artly_reminder_engine_url" class="regular-text" value="<?php echo esc_attr( $api_url ); ?>" required />
          </td>
        </tr>
        <tr>
          <th scope="row"><label for="artly_reminder_engine_secret"><?php esc_html_e( 'Reminder Engine Secret', 'artly-reminder-bridge' ); ?></label></th>
          <td>
            <input name="artly_reminder_engine_secret" type="text" id="artly_reminder_engine_secret" class="regular-text" value="<?php echo esc_attr( $api_secret ); ?>" required />
          </td>
        </tr>
      </table>
      <p class="submit">
        <button type="submit" name="submit" class="button button-primary"><?php esc_html_e( 'Save settings', 'artly-reminder-bridge' ); ?></button>
      </p>
    </form>
    <div style="max-width: 700px; margin-top: 20px;">
      <h2><?php esc_html_e( 'Manual Sync', 'artly-reminder-bridge' ); ?></h2>
      <p><?php esc_html_e( 'Use these buttons to manually sync data from WooCommerce to the Reminder Engine:', 'artly-reminder-bridge' ); ?></p>
      <form method="post" style="margin-top: 10px;">
        <?php wp_nonce_field( 'artly_reminder_bridge_save', 'artly_reminder_bridge_nonce' ); ?>
        <p>
          <button type="submit" name="artly_sync_users" value="1" class="button"><?php esc_html_e( 'Sync Users', 'artly-reminder-bridge' ); ?></button>
          <span class="description"><?php esc_html_e( 'Sync all WordPress users to the Reminder Engine', 'artly-reminder-bridge' ); ?></span>
        </p>
        <p>
          <button type="submit" name="artly_sync_points" value="1" class="button"><?php esc_html_e( 'Sync Points & Points Logs', 'artly-reminder-bridge' ); ?></button>
          <span class="description"><?php esc_html_e( 'Sync points events and logs from WooCommerce Points & Rewards', 'artly-reminder-bridge' ); ?></span>
        </p>
        <p>
          <button type="submit" name="artly_sync_charges" value="1" class="button"><?php esc_html_e( 'Sync Charges', 'artly-reminder-bridge' ); ?></button>
          <span class="description"><?php esc_html_e( 'Sync WooCommerce orders/charges to the Reminder Engine', 'artly-reminder-bridge' ); ?></span>
        </p>
      </form>
    </form>
  </div>
  <?php
}
