var ahmapsQueryAppConfig, jQuery, google;

/*
 * Use backbone.js to create an user interface for building queries against
 * the art history data served from the ArcGIS server at ahmapsQueryAppConfig.base_api_url.
 */

(function( $ ) {


	/*
	 * The basic unit of data returned by a GeoJSON query.
	 * Read only.
	 */
	var Feature = Backbone.Model.extend( {

		parse: function( response ) {
			var fields = {};
			// Fully qualified field names don't work with templates
			// We can use just the most specific name, skipping 'id'
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

		getType: function() {
			return this.type;
		},

		setType: function( type ) {
			if ( type === '1' ) {
				this.type = '1';
			} else {
				this.type = '0';
			}
			this.removeWheres();
			this.compile();
			return this;
		},

		getUrl: function() {
			return this.url;
		},

		getKmzUrl: function() {
			return this.url.replace( 'f=json', 'f=kmz' ) + '&ext=.kmz';
		},

		setUrl: function( url ) {
			// Convert KMZ to JSON internally
			this.url = url.replace( 'f=kmz', 'f=json' ).replace( '&ext=.kmz', '' );
			this.parse();
			return this;
		},

		getWhereCount: function() {
			return _.size( this.wheres );
		},

		getWhereValue: function( field, operator ) {
			return this.wheres[ field + ' ' + operator ];
		},

		getTrimmedWhereValue: function( field, operator ) {
			var value = this.getWhereValue( field, operator );
			if ( value ) {
				return value.replace( /^[\s'%]+|[\s'%]+$/g, '' );
			}
		},

		setWhere: function( field, operator, value ) {
			var key = field + ' ' + operator;
			if ( !( key in this.wheres && this.wheres[key] === value ) ) {
				this.wheres[ field + ' ' + operator ] = value;
				this.compile();
			}
			return this;
		},

		removeWhere: function( field, operator ) {
			var key = field + ' ' + operator;
			if ( key in this.wheres ) {
				delete this.wheres[ field + ' ' + operator ];
				this.compile();
			}
			return this;
		},

		removeWheres: function() {
			this.wheres = {};
			this.compile();
			return this;
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

			if ( url.indexOf( '/1/query' ) > 0 ) {
				this.type = '1';
			} else {
				this.type = '0';
			}

			this.parameters = {};
			while( matches = paramRegexp.exec( querystring ) ) {
				this.parameters[ decode( matches[1] ) ] = decode( matches[2] );
			}

			this.indexWheres();

			this.trigger( 'parse', this );
		},

		compile: function() {
			var url = this.url.replace( /\/\d\/query/, '/' + this.type + '/query' ),
				a = $( '<a></a>' ).attr( 'href', url ).get( 0 ),
				clauses;

			// Build the URL from elements
			if ( this.wheres.length === 0 ) {
				delete this.parameters.where;
			} else {
				clauses = [];
				_.each( this.wheres, function( value, key ) {
					clauses.push( key + ' ' + value );
				});
				this.parameters.where = clauses.join( ' AND ' );
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
			this.$map = this.$( '.map' );
			this.map = new google.maps.Map( this.$map.get( 0 ), {
				center: new google.maps.LatLng( 0, 0 ),
				zoom: 1,
				mapTypeId: google.maps.MapTypeId.TERRAIN
			} );
			this.$queryTypeRadios = this.$( 'input.query-type' );
			this.$queryTypePanels = this.$( '.query-type-panel' ).hide().eq( 0 ).show().end();
			this.$mapPanel = this.$( '.map-panel' );
			this.$resultsList = this.$( '.results-list' );
			this.$resultsTBody = this.$resultsList.find( 'tbody' );
			this.$exhibitCount = this.$( '.exhibit-count' );

			this.$fetchButton  = this.$( 'button.fetch-button' ).click( $.proxy( function( e ) {
				e.preventDefault();
				this.fetch();
			}, this ) );

			this.$kmlUrlInput = this.$( 'input.kml-url' ) .focus( function() { $(this).select(); } )
				.keypress( function( e ) { e.preventDefault(); } )
				.mouseup( function( e ) { e.preventDefault(); } )

			// Trigger keypress for backspace
			this.$( 'input' ).on( 'keyup', function( e ) {
				if ( e.which === 8 ) {
					$( e.currentTarget ).trigger( 'keypress' );
				}
			} );

			this.query = options.query;
			this.query.on( 'compile', function() {
				this.$fetchButton.show();
				this.$mapPanel.hide();
				this.$resultsList.hide();
			}, this );

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
			'change input.query-type': 'setType',
			'keypress .query-type-panel input:text': 'acceptText',
			'blur .query-type-panel input:text': 'acceptText'
		},

		resizeMap: function() {
			var center = this.map.getCenter();
			google.maps.event.trigger( this.map, 'resize' );
			this.map.setCenter( center );
		},

		setType: function() {
			this.query.setType( this.$queryTypeRadios.filter( ':checked' ).val() );
			this.fetch();
			return this;
		},

		fetchIfEnterKey: function( e ) {
			if ( ( event.keyCode && event.keyCode === 13 ) || ( event.which && event.which === 13 ) ) {
				e.preventDefault();
				this.fetch();
			}
			return this;
		},

		updateSearchWhere: function( field, operator, value ) {
			if ( value ) {
				this.query.setWhere( field, operator, value );
			} else {
				this.query.removeWhere( field, operator );
			}
		},

		acceptText: function( e ) {
			var $target = $( e.currentTarget ),
				field = $target.data( 'field' ),
				operator = $target.data( 'operator' ),
				type = $target.data( 'type' ),
				text = $target.val();

			if ( text.length > 0 && 'string' === type ) {
				if ( 'LIKE' === operator ) {
					text = "'%" + text + "%'";
				} else {
					text = "'" + text + "'";
				}
			}
			this.updateSearchWhere( field, operator, text );
			this.fetchIfEnterKey( e );
			return this;
		},

		render: function() {
			var query = this.query,
				queryType = query.getType();

			// Set UI elements to current query values

			this.$queryTypeRadios.filter( '[value=' + queryType + ']' ).prop( 'checked', true );
			this.$queryTypePanels.hide().filter( '.query-type-' + queryType ).show()
				.find( 'input:text' ).each( function() {
					var $input = $( this ),
						type = $input.data( 'type' ),
						value;

					if ( 'string' === type ) {
						value = query.getTrimmedWhereValue( $input.data( 'field' ), $input.data( 'operator' ) );
					} else {
						value = query.getWhereValue( $input.data( 'field' ), $input.data( 'operator' ) );
					}
					$input.val( value );
				} );

			this.$exhibitCount.text( this.featureCollection.length );

			if ( this.query.getWhereCount() ) {
				this.$kmlUrlInput.val( this.query.getKmzUrl() );
			} else {
				this.$kmlUrlInput.val( '' );
			}

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

			if ( !( 'kmlLayer' in this ) ) {
				this.kmlLayer = new google.maps.KmlLayer( { map: this.map } );
			}
			if ( 0 === this.featureCollection.length ) {

				this.kmlLayer.setMap( null );
				this.map.setCenter( new google.maps.LatLng( 0, 0 ) );
				this.map.setZoom( 1 );
				this.trigger( 'noResultsFound' );

			} else {

				this.kmlLayer.setUrl( this.query.getKmzUrl() );
				this.kmlLayer.setMap( this.map );
				google.maps.event.addListener( this.kmlLayer, 'defaultviewport_changed', $.proxy( function() {
					this.trigger( 'newCenter', this.kmlLayer.getDefaultViewport().getCenter() );
				}, this ) );

			}
			this.$fetchButton.hide();
			this.$mapPanel.show();
			this.$resultsList.show();
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
				'1/query?where=annee_debut>=1950+AND+annee_fin<=1950' +
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
			this.$tabs = $( '#ahmaps_query_tabs' ).tabs( { active: 0, activate: $.proxy( this.switchTab, this ) } ).hide();
			this.$message = $( '#ahmaps_message' ).hide();
			this.$centerLatInput = $( '#ahmaps_center_lat' );
			this.$centerLngInput = $( '#ahmaps_center_lng' );
			this.$attachButton = this.$( 'input.attach-button' );
			
			this.queryViews[0].on( 'newCenter', this.newCenter, this );
			this.activeQueryIndex = 0;

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
			_.invoke( this.queryViews, 'fetch' );
		},

		attachData: function( e ) {
			this.$primaryKmlUrlInput.val( this.queryViews[0].query.getKmzUrl() );
		}, 

		switchTab: function( e, ui ) {
			this.activeQueryIndex = ui.newTab.index();
			this.queryViews[ this.activeQueryIndex ].resizeMap();
		},

		newCenter: function( centerLatLng ) {
			if ( centerLatLng ) {
				this.$centerLatInput.val( centerLatLng.lat() );
				this.$centerLngInput.val( centerLatLng.lng() );
			}
		}, 

		showTabs: function() {
			this.$newPanel.hide();
			this.$busyPanel.hide();
			this.$tabs.show();
			this.queryViews[this.activeQueryIndex].resizeMap();
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
