<?php
/**
 * Art History Maps query form HTML.
 *
 * @package ArtHistoryMaps
 */
global $post_ID;
$json_query_url = '';
$stored_kml_url = get_post_meta( $post_ID, 'ahmaps_kml_url', true );
if ( $stored_kml_url ) {
	if ( strpos( $stored_kml_url, '?surl=' ) ) {
		 if ( preg_match( '/\?surl=(.*)$/', $stored_kml_url, $matches ) ) {
			 $json_query_url = urldecode( $matches[1] );
		 }
	} else {
		$json_query_url = str_replace( '/kml', '/geojson', $stored_kml_url );
	}
}

$artist_ids = array();
if ( strpos( $stored_kml_url, 'artistid' ) ) {
	if ( preg_match( '/artistid=([^&]*)/', $stored_kml_url, $matches ) ) {
		$artist_ids = explode( ',', urldecode( $matches[1] ) );
	}
}

if( !class_exists( 'WP_Http' ) )
	include_once( ABSPATH . WPINC. '/class-http.php' );
$http = new WP_Http();
$response = $http->get( 'http://geodev.lib.purdue.edu/dossin/api/artists/json' );
$artists = array();
if ( !is_wp_error( $response ) and $response['response']['code'] == '200' ) {
	$body = json_decode( $response['body'] );
	if ( count( $body->results[0] ) > 0 ) 
		$artists = $body->results[0];
}

?>
<div id="ahmaps_query_form">
<input id="ahmaps_stored_kml_url" type="hidden" value="<?php echo $stored_kml_url; ?>" />
<input id="ahmaps_json_query_url" name="ahmaps_json_query_url" type="hidden" value="<?php echo $json_query_url; ?>" />
<input id="ahmaps_nonce" name="ahmaps_nonce" type="hidden" value="<?php echo wp_create_nonce(); ?>" />
<input id="ahmaps_center_lat" name="ahmaps_center_lat" type="hidden" value="" />
<input id="ahmaps_center_lng" name="ahmaps_center_lng" type="hidden" value="" />
<div id="ahmaps_busy" style="text-align:center;">
	<img src="<?php echo ArtHistoryMaps::$url_path; ?>/media/spinner3-greenie.gif" 
		title="Loading..." />
</div>

<div id="ahmaps_message" class="error" style="display:none;"></div>

<div id="ahmaps_query_panel" style="display:none;">
	<div id="ahmaps_query_summary"></div>

	<div id="ahmaps_map_panel" style="float:right; text-align:center;">
		<div id="ahmaps_map" style="width:256px; height:256px;"></div>
	</div>
			
	<p>
		<select id="ahmaps_artist_select" class="ahmaps-filter-select" size="7" multiple="true">
			<option value="any"<?php if ( empty( $artist_ids ) ) echo ' selected="selected"'; ?>>any</option>
		<?php foreach( $artists as $artist ) : ?>
			<option value="<?php echo $artist->id; ?>"<?php if ( in_array( $artist->id, $artist_ids ) ) echo ' selected="selected"'; ?>><?php echo $artist->name; ?></option>
		<?php endforeach; ?>
		</select>
	</p>
	
	<p>
		<label>Year Range</label>
		<input id="ahmaps_year_begin" class="no-submit" type="text" size="5" value="1900" /> to
		<input id="ahmaps_year_end" class="no-submit" type="text" size="5" />
		<button id="ahmaps_range_button">Limit Range</button>
	</p>

	<p>
		<label>Type of Map</label>
		<input id="ahmaps_map_type_point" type="radio" name="ahmaps_map_type" value="point" /> Point
		<input id="ahmaps_map_type_heat" type="radio" name="ahmaps_map_type" value="heat" /> Heat
	</p>

	<div id="ahmaps_results_panel">
		<table id="ahmaps_results_table">
			<thead><tr><th>Exhibit</th></tr></thead>
			<tbody></tbody>
		</table>
	</div>

	<div style="clear:both; display:none;"><a id="ahmaps_query_link" href=""></a></div>

	<div class="submit">
		<input id="ahmaps_attach_button" name="ahmaps_attach_button" type="submit" value="Attach this data" />
	</div>
</div>

<div id="ahmaps_new_panel" style="display:none;">
	<p>No art history maps data is attached. <a href="<?php echo ArtHistoryMaps::api_url( 'exhibitions/geojson' ) . '?year_start=1946&amp;year_end=1950'; ?>" class="ahmaps-filter-link">Add data</a></p>
</div>
</div><!-- id="ahmaps_query_form" -->
