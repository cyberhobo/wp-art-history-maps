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
			var fields = {};
			_.each( response.attributes, function( value, name ) {
				var names = name.split( '.' ),
					name = names.pop();
				if ( 'id' !== name ) {
					fields[ name ] = value;
				}
			});
			return _.extend( fields, response.geometry );
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

	/**
	 * Manage an artlas gis query.
	 * @param data
	 * @constructor
	 */
	var ArtlasQuery = function( data ) {
		this.clauseRegexp = /([^\s<>=]+)\s*(LIKE|IN|[<>=]+)\s*([^\s]+)/i,
		this.parameters = {};
		this.wheres = {};
		this.url = '';

		if ( typeof data === 'object' ) {
			this.parameters = data;
			this.compile();
		} else if ( typeof data == 'string' ) {
			this.setUrl( data );
		}

	};

	_.extend( ArtlasQuery.prototype, Backbone.Events, {

		getUrl: function() {
			return this.url;
		},

		setUrl: function( url ) {
			this.url = url;
			this.parse();
			return this;
		},

		getWhereValue: function( field, operator ) {
			return this.wheres[ field + ' ' + operator ];
		},

		setWhere: function( clause ) {
			var matches;

			if ( this.clauseRegex.exec( clause ) ) {
				this.wheres[ matches[1] + ' ' + matches[2] ] = matches[3];
			}
			this.compile();
			return this;
		},

		removeWhere: function( field, operator ) {
			delete this.wheres[ field + ' ' + operator ];
		},

		indexWheres: function() {
			var andRegexp = /\s+AND\s+/i,
				clauses;

			this.wheres = {};
			if ( 'where' in this.parameters ) {
				clauses = this.parameters.where.split( andRegexp );
				_.each( clauses, function( clause ) {
					var matches;
					if ( matches = this.clauseRegexp.exec( clause ) ) {
						this.wheres[ matches[1] + ' ' + matches[2] ] = matches[3];
					}
				}, this );
			}
		},

		parse: function() {
			var url = this.url,
				a = $( '<a></a>' ).attr( 'href', url ).get( 0 ),
				querystring = a.search.slice( 1 ),
				decode = function( s ) { return decodeURIComponent( s.replace(/\+/g, ' ' ) ); },
				paramRegexp = /([^&=]+)=?([^&]*)/g,
				matches;

			this.parameters = {};
			while( matches = paramRegexp.exec( querystring ) ) {
				this.parameters[ decode( matches[1] ) ] = decode( matches[2] );
			}

			this.indexWheres();

			this.trigger( 'parse', this );
		},

		compile: function() {
			var url = this.url,
				a = $( '<a></a>' ).attr( 'href', url ).get( 0 );

			// Build the URL from elements
			if ( this.wheres.length === 0 ) {
				delete this.parameters.where;
			} else {
				this.parameters.where = this.wheres.join( ' AND ' );
			}

			a.search = '';
			_.each( this.parameters, function( value, name ) {

				if ( a.search ) {
					a.search += '&';
				} else {
					a.search += '?';
				}

				a.search += name + '=' + encodeURIComponent( value );
			} );

			this.url = a.href;
			this.trigger( 'compile', this );
		}

	});

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

			this.query = options.query;
			this.query.on( 'compile', this.fetch, this );

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
				this.artlasQuery.removeWhere( 'artlas.artlas.pays.id', '=' );
				this.$countrySelect.val( ['any'] );
			} else {
				this.artlasQuery.setWhere( 'artlas.artlas.pays.id = ' + this.$countrySelect.val() );
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
			return this;
		},

		render: function() {
			// Set UI elements to current query values

			this.$exhibitorInput.val( this.query.getWhereValue( 'artlas.artlas.%expose_person.nom', 'LIKE' ) );
			this.$countrySelect.val( this.query.getWhereValue( 'artlas.artlas.pays.id', '=' ) );

			this.$yearStartInput.val( this.query.getWhereValue( 'artlas.artlas.date.annee', '>=' ) );
			this.$yearEndInput.val( this.query.getWhereValue( 'artlas.artlas.date.annee', '<=' ) );
			this.$rangeButton.hide();
			
			this.$exhibitCount.text( this.featureCollection.length );

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
					var lonlat = new OpenLayers.LonLat( feature.get( 'x' ), feature.get( 'y' ) )
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

			this.featureCollection.url = this.query.getUrl();

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
			this.defaultQueryUrl = ahmapsQueryAppConfig.apiBaseUrl +
				'0/query?where=artlas.artlas.date.annee>=1950+AND+artlas.artlas.date.annee<=1950' +
				'&outFields=*&returnGeometry=true&f=json';
			this.queryViews = [ 
				new QueryView( {
					el: $( '#ahmaps_featured_query' ).get( 0 ),
					query: new ArtlasQuery( this.$primaryKmlUrlInput.val() )
				} ),
				new QueryView( {
					el: $( '#ahmaps_scratch_query' ).get( 0 ),
					query: new ArtlasQuery( this.defaultQueryUrl )
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
			this.queryViews[0].query.setUrl( this.defaultQueryUrl );
			this.queryViews[1].fetch();
		},

		attachData: function( e ) {
			this.$primaryKmlUrlInput.val( this.queryViews[0].query.getUrl() );
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
			if ( this.queryViews[0].query.getUrl() != this.$primaryKmlUrlInput.val() ) {
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
