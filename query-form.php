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

$country_ids = array();
if ( strpos( $json_query_url, 'countryid' ) ) {
	if ( preg_match( '/countryid=([^&]*)/', $json_query_url, $matches ) ) {
		$country_ids = explode( ',', urldecode( $matches[1] ) );
	}
}

if( !class_exists( 'WP_Http' ) )
	include_once( ABSPATH . WPINC. '/class-http.php' );
$http = new WP_Http();

$selected_artist_ids = array();
if ( strpos( $json_query_url, 'artistid' ) ) {
	if ( preg_match( '/artistid=([^&]*)/', $json_query_url, $matches ) ) {
		$selected_artist_ids = explode( ',', urldecode( $matches[1] ) );
	}
}
$artist_response = $http->get( 'http://geodev.lib.purdue.edu/dossin/api/artists/json' );
$artists = array();
if ( !is_wp_error( $artist_response ) and $artist_response['response']['code'] == '200' ) {
	$body = json_decode( $artist_response['body'] );
	if ( count( $body->results[0] ) > 0 ) 
		$artists = $body->results[0];
}

$selected_country_ids = array();
if ( strpos( $json_query_url, 'countryid' ) ) {
	if ( preg_match( '/countryid=([^&]*)/', $json_query_url, $matches ) ) {
		$selected_country_ids = explode( ',', urldecode( $matches[1] ) );
	}
}
$country_response = $http->get( 'http://geodev.lib.purdue.edu/dossin/api/countries/json' );
$countries = array();
if ( !is_wp_error( $country_response ) and $country_response['response']['code'] == '200' ) {
	$body = json_decode( $country_response['body'] );
	if ( count( $body->results[0] ) > 0 ) {
		$countries = $body->results[0];
		usort( $countries, create_function( '$a,$b', 'if ( $a->name == $b->name ) return 0; else return ( $a->name < $b->name ) ? -1 : 1;' ) );
	}
}

$filter_response = $http->get( 'http://geodev.lib.purdue.edu/dossin/api/filters/exhibitions/json' );
$filters = array();
$selected_filters = array();
if ( !is_wp_error( $filter_response ) and $filter_response['response']['code'] == '200' ) {
	$body = json_decode( $filter_response['body'] );
	foreach ( $body->results[0] as $filter ) {
		if ( strpos( $filter->desc, 'classified' ) )
			$filters[] = $filter;
		if ( strpos( $json_query_url, $filter->attname ) ) {
			if ( preg_match( "/{$filter->attname}=([^&]*)/", $json_query_url, $matches ) ) {
				$selected_filters[] = $filter->attname;
			}
		}
	}
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

<div id="ahmaps_results_panel" style="float:right; width:49%;">
	<div id="ahmaps_map_panel" style="text-align:center; display:none;">
		<div id="ahmaps_map" style="height:256px;"></div>
	</div>
	<div id="ahmaps_results_list" style="max-height: 270px; overflow-y: auto;">
		<table id="ahmaps_results_table" style="display:none;">
			<thead><tr><th><span class="ahmaps-exhibit-count"></span> Exhibits</th></tr></thead>
			<tbody></tbody>
		</table>
	</div>
</div>

<div id="ahmaps_query_panel" style="display:none; width:49%;">
	<div id="ahmaps_query_summary"></div>

	<p>
		<label>Artist</label>
		<select id="ahmaps_artist_select" class="ahmaps-filter-select" size="7" multiple="true">
			<option value="any"<?php if ( empty( $selected_artist_ids ) ) echo ' selected="selected"'; ?>>any</option>
			<?php foreach( $artists as $artist ) : ?>
			<option value="<?php echo $artist->id; ?>"<?php if ( in_array( $artist->id, $selected_artist_ids ) ) echo ' selected="selected"'; ?>><?php echo $artist->name; ?></option>
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
		<label>Country</label>
		<select id="ahmaps_country_select" class="ahmaps-filter-select" size="7" multiple="true">
			<option value="any"<?php if ( empty( $country_ids ) ) echo ' selected="selected"'; ?>>any</option>
			<?php foreach( $countries as $country ) : ?>
			<option value="<?php echo $country->id; ?>"<?php if ( in_array( $country->id, $selected_country_ids ) ) echo ' selected="selected"'; ?>><?php echo $country->name . ' (' . $country->iso . ')'; ?></option>
			<?php endforeach; ?>
		</select>
	</p>

	<p>
		<label>Style</label>
		<select id="ahmaps_filter_select" class="ahmaps-filter-select" size="7" multiple="true">
			<option value="any"<?php if ( empty( $selected_filters ) ) echo ' selected="selected"'; ?>>any</option>
			<?php foreach( $filters as $filter ) : ?>
			<option<?php if ( in_array( $filter->attname, $selected_filters ) ) echo ' selected="selected"'; ?>><?php echo $filter->attname; ?></option>
			<?php endforeach; ?>
		</select>
	</p>
		
	<p>
		<label>Type of Map</label>
		<input id="ahmaps_map_type_point" type="radio" name="ahmaps_map_type" value="point" /> Point
		<input id="ahmaps_map_type_heat" type="radio" name="ahmaps_map_type" value="heat" /> Heat
	</p>

	<p class="ahmaps-heat-parameter">
		<label>Heat Map Resolution</label>
		<input id="ahmaps_heat_map_resolution" class="no-submit" type="text" name="ahmaps_heat_map_resolution" size="4" value="200" />
		<button id="ahmaps_resolution_button">Set Resolution</button>
	</p>

	<p class="ahmaps-heat-parameter">
		<label>Heat Map Color Scheme</label>
		<input id="ahmaps_heat_map_ramp_classic" type="radio" name="ahmaps_heat_map_ramp" value="classic" /> Classic
		<input id="ahmaps_heat_map_ramp_viking" type="radio" name="ahmaps_heat_map_ramp" value="viking" /> Viking
		<input id="ahmaps_heat_map_ramp_sethoscope" type="radio" name="ahmaps_heat_map_ramp" value="sethoscope" /> Sethoscope
	</p>

	<div class="submit">
		<input id="ahmaps_attach_button" name="ahmaps_attach_button" type="submit" value="Attach this data" />
	</div>
</div>

<div id="ahmaps_new_panel" style="display:none;">
	<p>No art history maps data is attached. <a href="<?php echo ArtHistoryMaps::api_url( 'exhibitions/geojson' ) . '?year_start=1946&amp;year_end=1950'; ?>" class="ahmaps-filter-link">Add data</a></p>
</div>

<div style="clear:both; display:none;"><a id="ahmaps_query_link" href=""></a></div>

</div><!-- id="ahmaps_query_form" -->
