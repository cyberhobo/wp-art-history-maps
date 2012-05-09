jQuery( function( $ ) {
	var $form = $( '#ahmaps_query_form' ),
		$stored_kml_url_input = $( '#ahmaps_stored_kml_url' ),
		$json_query_url_input = $( '#ahmaps_json_query_url' ),	
		$center_lat_input = $( '#ahmaps_center_lat' ),
		$center_lng_input = $( '#ahmaps_center_lng' ),
		$message_panel = $( '#ahmaps_message' ),
		$busy_panel = $( '#ahmaps_busy' ),
		$new_panel = $( '#ahmaps_new_panel' ),
		$new_button = $( '#ahmaps_new_button' ),
		$query_panel = $( '#ahmaps_query_panel' ),
		$results_tbody = $( '#ahmaps_results_table tbody' ),
		$artist_select = $( '#ahmaps_artist_select' ),
		$year_start_input = $( '#ahmaps_year_begin' ),
		$year_end_input = $( '#ahmaps_year_end' ),
		$range_button = $( '#ahmaps_range_button' ),
		$map_type_point = $( '#ahmaps_map_type_point' ),
		$map_type_heat = $( '#ahmaps_map_type_heat' ),
		$map = $( '#ahmaps_map' ),
		$attach_button = $( '#ahmaps_attach_button' ),
		map_initialized = false,
		map = null,
		kml_layer = null,
		
		/*
		 * Load the maps API
		 */
		init_map = function() {
			if ( typeof google === 'object' && typeof google.maps === 'object' && typeof google.maps.Map === 'function' ) {
				// The google maps API must be present to proceed
				map = new google.maps.Map2( $( '#ahmaps_map' ).get( 0 ) );
				map.setCenter( new google.maps.LatLng( 0, 0 ), 1, G_PHYSICAL_MAP );
				map_initialized = true;
			} 
			return map_initialized;
		},

		/*
		 * Object to manage the current query
		 */
		query = (function() {
			var query = {},
				$query_link = $( '#ahmaps_query_link' ),
				query_a = $query_link.get( 0 ),
				params;

			function parseParams() {
				var e,
					d = function (s) { return decodeURIComponent(s.replace(/\+/g, " ")); },
					q = query_a.search.substring(1),
					r = /([^&=]+)=?([^&]*)/g;

				params = {};
				while (e = r.exec(q)) {
					params[d(e[1])] = d(e[2]);
				}
			}

			function compileParams() {
				query_a.search = '';
				for( param in params ) {
					if ( params.hasOwnProperty( param ) && 'function' !== typeof param ) {
						if ( query_a.search ) {
							query_a.search += '&';
						} else {
							query_a.search += '?';
						}
						query_a.search += param + '=' + encodeURIComponent( params[param] );
					}
				}
				$query_link.text( query_a.href );
			};

			query.getHref = function() {
				return $query_link.attr( 'href' );
			};

			query.setHref = function( href ) {
				$query_link.attr( 'href', href ).text( href );
				parseParams();
			};

			query.getParameter = function( name ) {
				return params[name];
			};

			query.removeParameter = function( name ) {
				if ( params.hasOwnProperty( name ) ) {
					delete params[name];
				}
				compileParams();
			};

			query.setParameter = function( name, value ) {
				params[name] = value;
				compileParams();
			};

			query.execute = function() {
				var url = query_a.href;
				$message_panel.text( '' ).hide();
				$new_panel.hide();
				$query_panel.hide();
				$busy_panel.show();
				$attach_button.hide();
				$.ajax( {
					url: url,
					dataType: 'jsonp',
					success: loadJSON
				} ).error( function( request, text_status, error ) {
					$message_panel.text( error ).show();
					$busy_panel.hide();
					$query_panel.show();
				} );
			};
			return query;
		})(),

		/*
		 * Load an OpenContext.org json response
		 */
		loadJSON = function( data, text_status ) {
			var bounds, kml_url;

			if ( ! data ) {
				$message_panel.append( $( '<span></span>' ).text( 'Got an empty response. ' ) )
					.append( $( '<a class="ahmaps-filter-link">Try again?</a>' ).attr( 'href', query.getHref() ) )
					.show();
				return false;
			}

			$busy_panel.hide();
			$query_panel.show();
			if ( ! map_initialized ) {
				if ( ! init_map() ) {
					setTimeout( function() { loadJSON( data, text_status ) }, 100 );
					return false;
				}
			}

			$year_start_input.val( ( query.getParameter( 'year_start' ) ? query.getParameter( 'year_start' ) : '' ) );
			$year_end_input.val( ( query.getParameter( 'year_end' ) ? query.getParameter( 'year_end' ) : '' ) );
			$range_button.hide();

			if ( query.getParameter( 'map_type' ) == 'heat' ) {
				$map_type_heat.prop( 'checked', true );
			} else {
				$map_type_point.prop( 'checked', true );
			}

			$results_tbody.empty();
			if ( kml_layer ) {
				map.removeOverlay( kml_layer );
			}

			if ( data.features.length === 0 ) {

				kml_layer = null;
				map.setCenter( new google.maps.LatLng( 0, 0 ), 1 );
				$message_panel.append( $( '<span></span>' ).text( 'No results found.' ) ).show();

			} else {
				
				if ( query.getParameter( 'map_type' ) == 'heat' ) {
					kml_url = 'http://geo.lib.purdue.edu/heatmapr/api/geojson/400/classic.kml?surl=' + 
						encodeURIComponent( query.getHref() );
				} else {
					kml_url = query.getHref().replace( 'geojson', 'kml' );
				}
				kml_layer = new google.maps.GeoXml( kml_url );
				map.addOverlay( kml_layer );
				google.maps.Event.addListener( kml_layer, 'load', function() {
					kml_layer.gotoDefaultViewport( map );
					$center_lat_input.val( kml_layer.getDefaultCenter().lat() );
					$center_lng_input.val( kml_layer.getDefaultCenter().lng() );
				});
				$.each( data.features, function( index, item ) {
					$results_tbody.append(
						$( '<tr></tr>' )
							.append( $( '<td></td>' ).text( item.properties.exhib_name ) )
					);
				} );
			}

			if ( $json_query_url_input.val() != query.getHref() ) {
				$attach_button.show();
			} else {
				$attach_button.hide();
			}
		};
	
	if ( $stored_kml_url_input.val() ) {
		query.setHref( $json_query_url_input.val() );
		$.ajax( {
			url: $json_query_url_input.val() + '&callback=?',
			dataType: 'json',
			success: loadJSON
		} ).error( function( request, text_status, error ) {
			$message_panel.text( error ).show();
			$busy_panel.hide();
			$query_panel.show();
		} );
	} else {
		$busy_panel.hide();
		$new_panel.show();
	}

	$form.delegate( '.ahmaps-filter-link', 'click', function() {
		query.setHref( this.href );
		query.execute();
		return false;
	} );

	$form.delegate( 'input[name=ahmaps_map_type]', 'change', function() {
		query.setParameter( 'map_type', $( this ).val() );
		query.execute();
		return true;
	} );

	$( 'input[type=text].no-submit' ).keypress( function( e ) {
		if ( ( e.keyCode && e.keyCode === 13 ) || ( e.which && e.which === 13 ) ) {
			return false;
		}
		return true;
	} );
	
	$artist_select.change( function() {

		if ( $artist_select.val().join('').indexOf( 'any' ) >= 0 ) {
			query.removeParameter( 'artistid' );
			$artist_select.val( ['any'] );
		} else {
			query.setParameter( 'artistid', $artist_select.val().join(',') );
		}
		query.execute();

		return true;
	} );

	$range_button.click( function() {
		var year_start = parseInt( $year_start_input.val() ),
			year_end = parseInt( $year_end_input.val() );
		if ( !isNaN( year_start ) ) {
			query.setParameter( 'year_start', year_start );
		}
		if ( !isNaN( year_end ) ) {
			query.setParameter( 'year_end', year_end );
		}
		query.execute();
		return false;
	}	);
	$year_start_input.keyup( function( e ) {
		var valid_parts = $year_start_input.val().match( /-?\d*/ );
		if ( valid_parts ) {
			$year_start_input.val( valid_parts[0] );
			$range_button.show();
		} else {
			$year_start_input.val( '' );
		}
	} );
	$year_end_input.keyup( function( e ) {
		var valid_parts = $year_end_input.val().match( /-?\d*/ );
		if ( valid_parts ) {
			$year_end_input.val( valid_parts[0] );
			$range_button.show();
		} else {
			$year_end_input.val( '' );
		}
	} );

	$attach_button.click( function() {
		$json_query_url_input.val( query.getHref() );
	} );
} );
