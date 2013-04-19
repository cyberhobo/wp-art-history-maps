<?php
/**
 * Art History Maps query form HTML.
 *
 * @package ArtHistoryMaps
 */
global $post_ID;
$stored_kml_url = get_post_meta( $post_ID, 'ahmaps_kml_url', true );
$more_kml_urls = get_post_meta( $post_ID, 'ahmaps_more_kml_url' );

if( !class_exists( 'WP_Http' ) )
	include_once( ABSPATH . WPINC. '/class-http.php' );
$http = new WP_Http();

$country_response = $http->get( 'http://geodev.lib.purdue.edu/dossin/api/countries/json' );
$countries = array();
if ( !is_wp_error( $country_response ) and $country_response['response']['code'] == '200' ) {
	$body = json_decode( $country_response['body'] );
	if ( count( $body->results[0] ) > 0 ) {
		$countries = $body->results[0];
		usort( $countries, create_function( '$a,$b', 'if ( $a->name == $b->name ) return 0; else return ( $a->name < $b->name ) ? -1 : 1;' ) );
	}
}

?>
<div id="ahmaps_query_app">
<input id="ahmaps_nonce" name="ahmaps_nonce" type="hidden" value="<?php echo wp_create_nonce(); ?>" />
<input id="ahmaps_stored_kml_url" name="ahmaps_stored_kml_url" type="hidden" value="<?php echo $stored_kml_url; ?>" />
<input id="ahmaps_center_lat" name="ahmaps_center_lat" type="hidden" value="" />
<input id="ahmaps_center_lng" name="ahmaps_center_lng" type="hidden" value="" />
<?php foreach ( $more_kml_urls as $more_kml_url ) :  ?>
	<input id="ahmaps_more_kml_url[]" type="hidden" value="<?php echo $more_kml_url; ?>" />
<?php endforeach; ?>

<div id="ahmaps_busy" class="busy-indicator"></div>

<div id="ahmaps_message" class="error"></div>

<div id="ahmaps_query_tabs">
	<ul>
		<li><a href="#ahmaps_featured_query">Featured Query</a></li>
		<li><a href="#ahmaps_scratch_query">Scratch Query</a></li>
	</ul>

	<div id="ahmaps_featured_query"></div>
	<div id="ahmaps_scratch_query"></div>
</div>

<div class="submit">
	<input class="attach-button" name="ahmaps_attach_button" type="submit" value="Attach this data" />
</div>

<div id="ahmaps_new_panel">
	<p>No art history maps data is attached. 
		<button class="add-data">Add data</button>
	</p>
</div>

</div><!-- id="ahmaps_query_app" -->

<script type="text/template" id="ahmaps_query_template">
<div class="results-panel">
	<div class="map-panel">
		<div class="map"></div>
	</div>
	<div class="results-list">
		<table>
			<thead><tr><th><span class="exhibit-count"></span> Exhibits</th></tr></thead>
			<tbody></tbody>
		</table>
	</div>
</div>

<div class="query-panel">
	<div class="query-summary"></div>

	<p>
		<label>Exhibitor</label>
		<input class="exhibitor no-submit" size="25" type="text" />
	</p>
	
	<p>
		<label>Year Range</label>
		<input class="year-start no-submit" type="text" size="5" value="1900" /> to
		<input class="year-end no-submit" type="text" size="5" />
		<button class="range-button">Limit Range</button>
	</p>

	<p>
		<label>Country</label>
		<select class="countries filter-select" size="7" multiple="true">
			<option value="any">any</option>
			<?php foreach( $countries as $country ) : ?>
			<option value="<?php echo $country->id; ?>"><?php echo $country->name . ' (' . $country->iso . ')'; ?></option>
			<?php endforeach; ?>
		</select>
	</p>

	<p>
		<label>KML URL</label>
		<input type="text" class="kml-url" size="55" />
	</p>
</div>
</script>

<script type="text/template" id="ahmaps_feature_template">
<td><%- exhib_name %></td>
</script>
