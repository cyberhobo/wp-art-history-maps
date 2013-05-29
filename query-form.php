<?php
/**
 * Art History Maps query form HTML.
 *
 * @package ArtHistoryMaps
 */
global $post_ID;
$stored_kml_url = get_post_meta( $post_ID, 'ahmaps_kml_url', true );
?>
<div id="ahmaps_query_app">
	<input id="ahmaps_nonce" name="ahmaps_nonce" type="hidden" value="<?php echo wp_create_nonce(); ?>" />
	<input id="ahmaps_stored_kml_url" name="ahmaps_stored_kml_url" type="hidden" value="<?php echo $stored_kml_url; ?>" />
	<input id="ahmaps_center_lat" name="ahmaps_center_lat" type="hidden" value="" />
	<input id="ahmaps_center_lng" name="ahmaps_center_lng" type="hidden" value="" />

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
		<button class="fetch-button">Show Results</button>
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
			<label>Query Type</label>
			<input class="query-type" type="radio" name="<%= cid %>_query_type" value="0" checked="checked" /> Exhibition
			<input class="query-type" type="radio" name="<%= cid %>_query_type" value="1" /> Exhibitor
		</p>

		<div class="query-type-panel query-type-0">
			<p>
				<label>Year Range</label>
				<input data-field="anneeb" data-operator=">=" data-type="integer" type="text" size="5" /> to
				<input data-field="anneef" data-operator="<=" data-type="integer" type="text" size="5" />
			</p>

			<p>
				<label>Country Search</label>
				<input data-field="pays" data-operator="LIKE" data-type="string" size="25" type="text" />
			</p>

			<p>
				<label>City Search</label>
				<input data-field="commune" data-operator="LIKE" data-type="string" size="25" type="text" />
			</p>

			<p>
				<label>Institution Search</label>
				<input data-field="complement" data-operator="LIKE" data-type="string" size="25" type="text" />
			</p>

			<p>
				<label>Title Search</label>
				<input data-field="titre" data-operator="LIKE" data-type="string" size="25" type="text" />
			</p>
		</div>

		<div class="query-type-panel query-type-1">
			<p>
				<label>Year Range</label>
				<input data-field="annee_debut" data-operator=">=" data-type="integer" type="text" size="5" /> to
				<input data-field="annee_fin" data-operator="<=" data-type="integer" type="text" size="5" />
			</p>
			<p>
				<label>Last Name Search</label>
				<input data-field="nom" data-operator="LIKE" data-type="string" size="25" type="text" />
			</p>
			<p>
				<label>First Name Search</label>
				<input data-field="prenom" data-operator="LIKE" data-type="string" size="25" type="text" />
			</p>
			<p>
				<label>Gender</label>
				<input data-field="sexe" data-operator="=" size="1" data-type="string" type="text" />
			</p>

			<p>
				<label>City Search</label>
				<input data-field="city" data-operator="LIKE" data-type="string" size="25" type="text" />
			</p>

			<p>
				<label>Country Search</label>
				<input data-field="country" data-operator="LIKE" data-type="string" size="25" type="text" />
			</p>

			<p>
				<label>Title Search</label>
				<input data-field="titre" data-operator="LIKE" data-type="string" size="25" type="text" />
			</p>
		</div>

		<p>
			<label>KML URL</label>
			<input type="text" class="kml-url" size="55" />
		</p>
	</div>
</script>

<script type="text/template" id="ahmaps_feature_template">
	<td><%- titre %></td>
</script>
