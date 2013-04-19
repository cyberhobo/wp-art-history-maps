var ahmapsQueryAppConfig, jQuery, OpenLayers;

/*
 * Use backbone.js to create an user interface for building queries against
 * the art history data served from ahmapsQueryAppConfig.base_api_url.
 */

(function( $ ) {


	/*
	 * The basic unit of data returned by a GeoJSON query.
	 * Read only.
	 */
	var Feature = Backbone.Model.extend( {

		parse: function( response ) {
			return _.extend( response.properties, response.geometry );
		}

	} );

	/*
	 * A collection of GeoJSON query results.
	 * Read only.
	 */
	var FeatureCollection = Backbone.Collection.extend( {

		model: Feature,

		parse: function( response ) {
			return response.features;
		}

	} );

	/*
	 * Model a geojson query, rather than the data it returns.
	 *
	 * Abusing a backbone model to compile a GeoJSON query URL
	 * from arguments, or parse an URL into arguments.
	 * Attributes of a GeoJsonQuery correspond to URL parameters,
	 * which are named with underscores (e.g. year_start).
	 */
	var GeoJsonQuery = Backbone.Model.extend( {
		
		initialize: function() {
			this.on( 'change', this.compile, this );
		},

		parseUrl: function() {
			var url = this.get( 'url' ),
				a = $( '<a></a>' ).attr( 'href', url ).get( 0 ),
				querystring = a.search.slice( 1 ),
				decode = function( s ) { return decodeURIComponent( s.replace(/\+/g, ' ' ) ); },
				paramRegexp = /([^&=]+)=?([^&]*)/g,
				params = {},
				matches;

			while( matches = paramRegexp.exec( querystring ) ) {
				params[ decode( matches[1] ) ] = decode( matches[2] );
			}
		
			this.set( params, { silent: true } );

		}, 

		compile: function() {
			var url = this.get( 'url' ), 
				a = $( '<a></a>' ).attr( 'href', url ).get( 0 );

			if ( this.hasChanged( 'url' ) ) {
				if ( this.compiling ) {
					// The URL has been built, done compiling
					this.compiling = false;
				} else {
					// Parsing is silent, will not trigger another compile
					this.parseUrl();
				}
				return;
			}

			// Build the URL from attributes

			this.compiling = true;

			a.search = '';
			_.each( this.attributes, function( value, name ) {

				if ( 'url' === name ) {
					// This is what we're building
					return;
				}

				if ( a.search ) {
					a.search += '&';
				} else {
					a.search += '?';
				}

				a.search += name + '=' + encodeURIComponent( value );
			} );

			this.set( 'url', a.href );
		}

	} );

	/*
	 * Model a kml query, rather than the data it returns.
	 *
	 * Abusing a backbone model to compile a KML query URL
	 * from arguments, or parse an URL into arguments.
	 * Includes a GeoJsonQuery's attributes and some 
	 * extras for heat maps.
	 */
	var KmlQuery = Backbone.Model.extend( {
		
		defaults: {
			mapType: 'point',
			heatMapRamp: 'classic',
			heatMapResolution: '200'
		}, 

		initialize: function() {
			this.geoJsonQuery = new GeoJsonQuery();
			this.geoJsonQuery.on( 'change', this.compile, this );
			this.on( 'change', this.compile, this );
			if ( this.get( 'url' ) ) {
				this.parseUrl();
			}
		},

		parseHeatMapUrl: function( heatMapUrl ) {
			var heatMapMatches = /geojson\/(\d*)\/(\w*)\.kml\?surl=(.*)$/.exec( heatMapUrl );

			if ( heatMapMatches && heatMapMatches.length === 4 ) {

				this.set( {
					mapType: 'heat',
					heatMapResolution: heatMapMatches[1],
					heatMapRamp: heatMapMatches[2]
				}, { silent: true } );

				this.geoJsonQuery.set( { url: decodeURIComponent( heatMapMatches[3] ) } );

			}
		},

		parseUrl: function() {
			var url = this.get( 'url' );
			
			if ( url.indexOf( '?surl' ) >= 0 ) {
				this.parseHeatMapUrl( url );
			} else {

				this.set( {
					mapType: 'point'
				}, { silent: true } );

				this.geoJsonQuery.set( { url: url.replace( '/kml', '/geojson' ) } );

			}
		},

		compile: function() {
			var fresh_url;

			if ( this.hasChanged( 'url' ) ) {

				if ( this.compiling ) {
					this.compiling = false;
				} else { 
					this.compiling = true;
					this.parseUrl();
				}

			} else {

				this.compiling = true;

				if ( 'point' === this.get( 'mapType' ) ) {
					
					fresh_url = this.geoJsonQuery.get( 'url' ).replace( '/geojson', '/kml' );

				} else { /* it's a heat map */

					fresh_url = ahmapsQueryAppConfig.heatmaprApiBaseUrl +
						this.get( 'heatMapResolution' ) + '/' +
						this.get( 'heatMapRamp' ) + '.kml?surl=' +
						encodeURIComponent( this.geoJsonQuery.get( 'url' ) );
				
				}

				this.set( 'url', fresh_url );
			}
		}
		
	} );

	/*
	 * Table row view of a feature.
 	 */
	var FeatureView = Backbone.View.extend( {
		
		tagName: 'tr', 

		model: Feature,

		template: _.template( $( '#ahmaps_feature_template' ).html() ),

		render: function() {
			this.$el.html( this.template( this.model.toJSON() ) );
			return this;
		}

	} );

	/* 
	 * UI to manipulate a query
	 */
	var QueryView = Backbone.View.extend( {
		
		template: _.template( $( '#ahmaps_query_template' ).html() ),

		initialize: function( options ) {
			// Create UI elements
			this.$el.html( this.template( { cid: this.cid } ) );

			// Reference UI elements
			this.$queryPanel = this.$( '.query-panel' );
			this.$resultsPanel = this.$( '.results-panel' );
			this.$map = this.$( '.map' );
			this.map = new OpenLayers.Map(
				this.$map.get( 0 ),
				{
					maxExtent: new OpenLayers.Bounds(-20037508.34,-20037508.34,20037508.34,20037508.34),
					maxResolution: 156543,
					numZoomLevels: 18,
					units: 'm',
					projection: 'EPSG:900913'
				}
			);
			this.map.addLayer( new OpenLayers.Layer.OSM() );
			this.icon = new OpenLayers.Icon(
				'http://www.openlayers.org/dev/img/marker.png',
			    new OpenLayers.Size( 11, 13 ),
			    new OpenLayers.Pixel( -5, -13 )
			);
			this.map.setCenter( new OpenLayers.LonLat( 0, 0 ), 1 );
			this.$resultsList = this.$( '.results-list' );
			this.$resultsTBody = this.$resultsList.find( 'tbody' );
			this.$exhibitCount = this.$( '.exhibit-count' );
			this.$exhibitorInput = this.$( 'input.exhibitor' );
			this.$countrySelect = this.$( 'select.countries' );
			this.$yearStartInput = this.$( 'input.year-start' );
			this.$yearEndInput = this.$( 'input.year-end' );
			this.$rangeButton  = this.$( 'button.range-button' );
			this.$kmlUrlInput = this.$( 'input.kml-url' )
				.focus( function() { $(this).select(); } )
				.keypress( function( e ) { e.preventDefault(); } )
				.mouseup( function( e ) { e.preventDefault(); } )

			this.model.on( 'change', this.fetch, this );

			this.featureCollection = new FeatureCollection();
			this.featureCollection.on( 'add', this.addFeature, this );
			this.featureCollection.on( 'reset', this.addFeatures, this );

			if ( 'fetchError' in options ) {
				this.fetchError = options.fetchError;
			} else {
				this.fetchError = function( request, text_status, error ) {
					alert( text_status );
				};
			}
		},

		events: {
			'keypress input:text.no-submit': 'swallowEnterKey',
			'keyup input.exhibitor': 'acceptExhibitor',
			'change select.countries': 'selectCountries',
			'keyup input.year-start': 'acceptYear',
			'keyup input.year-end': 'acceptYear',
			'click button.range-button': 'setRange'
		},

		acceptExhibitor: function( e ) {
			var $input = $( e.currentTarget );
			console.log( $input.val() );
		},

		selectCountries: function() {
			if ( this.$countrySelect.val().join('').indexOf( 'any' ) >= 0 ) {
				this.model.geoJsonQuery.unset( 'countryid' );
				this.$countrySelect.val( ['any'] );
			} else {
				this.model.geoJsonQuery.set( {
					countryid: this.$countrySelect.val().join( ',' ) 
				} );
			}
		},

		swallowEnterKey: function( e ) {
			if ( ( e.keyCode && e.keyCode === 13 ) || ( e.which && e.which === 13 ) ) {
				e.preventDefault();
			}
		}, 
	
		acceptYear: function( e ) {
			var $input = $( e.currentTarget ),
				valid_parts = $input.val().match( /-?\d*/ );

			if ( valid_parts ) {
				$input.val( valid_parts[0] );
				this.$rangeButton.show();
			} else {
				$input.val( '' );
			}
		},

		setRange: function( e ) {
			// Button event - don't submit the form
			e.preventDefault();
			this.model.geoJsonQuery.set( {
				year_start: this.$yearStartInput.val(),
				year_end: this.$yearEndInput.val()
			} );
		},

		render: function() {
			var copyUrl = '';
			
			// Set UI elements to current query values

			this.$exhibitorInput.val( ( this.model.geoJsonQuery.get( 'artistid' ) || '' ).split( ',' ) );
			this.$countrySelect.val( ( this.model.geoJsonQuery.get( 'countryid' ) || 'any' ).split( ',' ) );

			this.$yearStartInput.val( this.model.geoJsonQuery.get( 'year_start' ) );
			this.$yearEndInput.val( this.model.geoJsonQuery.get( 'year_end' ) );
			this.$rangeButton.hide();
			
			this.$exhibitCount.text( this.featureCollection.length );

			copyUrl = this.model.get( 'url' ); 
			this.$kmlUrlInput.val( copyUrl );

			return this;
		},

		addFeature: function( feature ) {
			var view = new FeatureView({model: feature});
			this.$resultsTBody.append( view.render().el );
		},

		addFeatures: function() {

			this.render();

			this.$exhibitCount.text( this.featureCollection.length );
			this.$resultsTBody.empty();
			this.featureCollection.each( this.addFeature, this );

			if ( this.kmlLayer ) {
				this.map.removeLayer( this.kmlLayer );
			}

			if ( 0 === this.featureCollection.length ) {

				this.kmlLayer = null;
				this.map.setCenter( new OpenLayers.LonLat( 0, 0 ), 1 );
				this.trigger( 'noResultsFound' );

			} else {

				if ( this.markerLayer ) {
					this.markerLayer.destroy();
				}
				this.markerLayer = new OpenLayers.Layer.Markers( 'Markers' );
				this.map.addLayer( this.markerLayer );
				this.markerExtent = new OpenLayers.Bounds();
				this.featureCollection.each( function( feature ) {
					var lonlat = new OpenLayers.LonLat( feature.get( 'coordinates' )[0], feature.get( 'coordinates' )[1] )
						.transform( new OpenLayers.Projection( 'EPSG:4326' ), this.map.getProjectionObject() ),
						marker = new OpenLayers.Marker( lonlat, this.icon.clone() );
					this.markerLayer.addMarker( marker );
					this.markerExtent.extend( lonlat );
				}, this );
				this.map.zoomToExtent( this.markerExtent );

				/* OpenLayers can't load remote data
				this.kmlLayer = new OpenLayers.Layer.Vector( 'KML', {
					strategies: [new OpenLayers.Strategy.Fixed()],
					protocol: new OpenLayers.Protocol.HTTP({
						url: this.model.get( 'url' ),
						format: new OpenLayers.Format.KML({
								extractStyles: true,
								extractAttributes: true,
								maxDepth: 2
						})
				   })
				});
				if ( this.map.addLayer( this.kmlLayer ) ) {
					this.map.zoomToExtent( this.kmlLayer.getExtent() );
					this.trigger( 'newCenter', this.kmlLayer.getExtent().getCenterLonLat() );
				}
				*/
			}
		},

		fetch: function() {
			this.trigger( 'fetch' );

			this.featureCollection.url = this.model.geoJsonQuery.get( 'url' );

			return this.featureCollection.fetch( {
				context: this,
				dataType: 'jsonp',
				reset: true
			} ).error( this.fetchError );
		}

	} );

	/*
	 * Overall UI
	 */
	var AppView = Backbone.View.extend( {
		
		el: $( '#ahmaps_query_app' ),

		events: {
			'click button.add-data': 'addData',
			'click input.attach-button': 'attachData'
		},

		initialize: function() {

			this.$primaryKmlUrlInput = $( '#ahmaps_stored_kml_url' );

			// Init the QueryViews before hiding things so the maps center correctly
			this.defaultQueryUrl = ahmapsQueryAppConfig.apiBaseUrl + 'exhibitions/kml?year_start=1950&year_end=1950'; 
			this.queryViews = [ 
				new QueryView( {
					el: $( '#ahmaps_featured_query' ).get( 0 ),
					model: new KmlQuery( { url: this.$primaryKmlUrlInput.val() } ) 
				} ),
				new QueryView( {
					el: $( '#ahmaps_scratch_query' ).get( 0 ),
					model: new KmlQuery( { url: this.defaultQueryUrl } )
				} )
			];

			// UI elements
			this.$busyPanel = $( '#ahmaps_busy' ).hide();
			this.$newPanel = $( '#ahmaps_new_panel' ).hide();
			this.$submitPanel = this.$( '.submit' ).hide();
			this.$tabs = $( '#ahmaps_query_tabs' ).tabs().hide();
			this.$message = $( '#ahmaps_message' ).hide();
			this.$centerLatInput = $( '#ahmaps_center_lat' );
			this.$centerLngInput = $( '#ahmaps_center_lng' );
			this.$attachButton = this.$( 'input.attach-button' );
			
			this.queryViews[0].on( 'newCenter', this.newCenter, this );

			// Enable a spinner while data is being fetched for any query
			_.each( this.queryViews, function( queryView ) {
				queryView.on( 'fetch', this.busy, this );
				queryView.featureCollection.on( 'reset', this.reset, this );
			}, this );

			if ( this.$primaryKmlUrlInput.val() ) {
				_.invoke( this.queryViews, 'fetch' );
			} else {
				this.$newPanel.show();
			}

		},

		addData: function( e ) {
			e.preventDefault();
			this.queryViews[0].model.set( { 
				url: this.defaultQueryUrl
			} );
			this.queryViews[1].fetch();
		},

		attachData: function( e ) {
			this.$primaryKmlUrlInput.val( this.queryViews[0].model.get( 'url' ) );
		}, 

		newCenter: function( centerLonLat ) {
			if ( centerLonLat ) {
				this.$centerLatInput.val( centerLonLat.lat );
				this.$centerLngInput.val( centerLonLat.lon );
			}
		}, 
			
		showTabs: function() {
			this.$newPanel.hide();
			this.$busyPanel.hide();
			this.$tabs.show();
		},

		busy: function() {
			this.$tabs.hide();
			this.$newPanel.hide();
			this.$busyPanel.show();
		},

		reset: function() {
			this.showTabs();
			if ( this.queryViews[0].model.get( 'url' ) != this.$primaryKmlUrlInput.val() ) {
				this.$submitPanel.show();
			}
		}

	} );

	// init on DOM ready
	$( function() {
		var ahmapsQueryApp = new AppView();

		// Might others need to reference our app?
		ahmapsQueryApp.$el.data( 'ahmapsQueryApp', ahmapsQueryApp );

	} );

}( jQuery ));
