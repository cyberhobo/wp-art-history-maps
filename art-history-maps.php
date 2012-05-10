<?php

/*
  Plugin Name: Art History Maps
  Plugin URI:
  Description: Query the Dossin art history web services for data to map in a post.
  Version: 1.0.1
  Author: Dylan Kuhn
  Author URI: http://www.cyberhobo.net/
  Minimum WordPress Version Required: 3.0
 */

/*
  Copyright (c) 2012 Dylan Kuhn

  This program is free software; you can redistribute it
  and/or modify it under the terms of the GNU General Public
  License as published by the Free Software Foundation;
  either version 2 of the License.

  This program is distributed in the hope that it will be
  useful, but WITHOUT ANY WARRANTY; without even the implied
  warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
  PURPOSE. See the GNU General Public License for more
  details.
 */

if ( !class_exists( 'ArtHistoryMaps' ) ) {

	/**
	 * The GPX Viewer singleton class
	 */
	class ArtHistoryMaps {

		static $dir_path;
		static $url_path;
		static $basename;
		static $version;
		static $api_base_url = 'http://geodev.lib.purdue.edu/dossin/api/';

		static function load() {

			// Initialize members
			self::$version = '1.0';
			self::$dir_path = dirname( __FILE__ );
			self::$basename = plugin_basename( __FILE__ );
			$dir_name = substr( self::$basename, 0, strpos( self::$basename, '/' ) );
			self::$url_path = plugins_url( '', __FILE__ );

			load_plugin_textdomain( 'ArtHistoryMaps', '', $dir_name );

			// Set up hooks
			add_action( 'init', array( __CLASS__, 'action_init' ) );
			add_action( 'admin_init', array( __CLASS__, 'action_admin_init' ) );
			add_action( 'admin_menu', array( __CLASS__, 'action_admin_menu' ) );
		}

		static function api_url( $path ) {
			return path_join( self::$api_base_url, $path );
		}

		static function action_init() {
			add_shortcode( 'ahmaps_kml_link', array( __CLASS__, 'shortcode_kml_link' ) );
		}

		static function action_admin_init() {
			add_action( 'save_post', array( __CLASS__, 'save_post' ), 10, 2 );
			add_action( 'admin_menu', array( __CLASS__, 'admin_menu' ) );
		}

		static function shortcode_kml_link( $args='', $content = null ) {
			$default_args = array(
				'text' => 'Art history data for Google Earth',
			);
			$args = wp_parse_args( $args, $default_args );
			$link = '';
			$kml_url = get_post_meta( get_the_ID(), 'ahmaps_kml_url', true );
			if ( $kml_url ) {
				$kml_url .= '&amp;ext=.kml';
				$link = '<a href="' . $kml_url . '">' . $args['text'] . '</a>';
			}
			return $link;
		}

		static function save_post( $post_id, $post ) {
			// Ignore revisions
			if ( 'revision' == $post->post_type )
				return;

			if ( empty( $_POST['ahmaps_json_query_url'] ) || empty( $_POST['ahmaps_attach_button'] ) ) {
				// Don't do anything without a query URL or when other submit buttons are used
				return;
			}

			wp_verify_nonce( 'ahmaps_nonce' );

			if ( 'heat' == $_POST['ahmaps_map_type'] ) {
				$new_kml_url = 'http://geo.lib.purdue.edu/heatmapr/api/geojson/400/classic.kml?surl=' . 
					urlencode( $_POST['ahmaps_json_query_url'] );
			} else {
				$new_kml_url = str_replace( '/geojson', '/kml', $_POST['ahmaps_json_query_url'] );
			}
			$saved_kml_url = get_post_meta( $post_id, 'ahmaps_kml_url', true );

			if ( $new_kml_url == $saved_kml_url ) {
				// Cached data is still good, nothing to do
				return;
			}

			update_post_meta( $post_id, 'ahmaps_kml_url', $new_kml_url );

			if ( class_exists( 'GeoMashupDB' ) ) {
				if ( isset( $_POST['ahmaps_center_lat'] ) and isset( $_POST['ahmaps_center_lng'] ) ) {
					// Use the center for the Geo Mashup location
					$location = array( 'lat' => $_POST['ahmaps_center_lat'], 'lng' => $_POST['ahmaps_center_lng'] );
					GeoMashupDB::set_object_location( 'post', $post_id, $location );
				}
			}
		}

		/*
		 * Make a proxy request to opencontext.org
		 * Should be obsoleted by JSONP client requests
		 */

		static function opencontext_proxy() {
			// TODO Verify a nonce?
			if ( !class_exists( 'WP_Http' ) )
				include_once( ABSPATH . WPINC . '/class-http.php' );

			unset( $_GET['action'] );
			$path = '';
			if ( isset( $_GET['path'] ) ) {
				$path = $_GET['path'];
				unset( $_GET['path'] );
			}
			$url = 'http://opencontext.org' . $path;
			$http = new WP_Http;
			$get = $http->request( $url );
			if ( is_wp_error( $get ) ) {
				status_header( $get->get_error_code() );
			} else {
				status_header( $get['response']['code'] );
				echo $get['body'];
			}
			exit();
		}

		/**
		 * Add an admin menu page and maybe editor meta box.
		 */
		static function action_admin_menu() {
			global $pagenow;

			if ( 'post-new.php' == $pagenow or ( 'post.php' == $pagenow and isset( $_GET['action'] ) and 'edit' == $_GET['action'] ) ) {

				// Enqueue query form resources
				wp_enqueue_script( 'google-maps-2' );
				wp_enqueue_script( 'ahmaps-query-form', path_join( self::$url_path, "query-form.js" ), array( 'jquery' ), self::$version, true );

				// Add the meta box for all relevant post types
				if ( function_exists( 'get_post_types' ) ) {
					$post_types = get_post_types( array( ), 'objects' );
					foreach ( $post_types as $post_type ) {
						if ( !isset( $post_type->show_ui ) or $post_type->show_ui ) {
							add_meta_box( 'ahmaps_post_edit', __( 'Art History Query', 'ArtHistoryMaps' ), array( __CLASS__, 'print_form' ), $post_type->name, 'advanced' );
						}
					}
				} else {
					add_meta_box( 'ahmaps_post_edit', __( 'Open Context Query', 'ArtHistoryMaps' ), array( __CLASS__, 'print_form' ), 'post', 'advanced' );
					add_meta_box( 'ahmaps_post_edit', __( 'Open Context Query', 'ArtHistoryMaps' ), array( __CLASS__, 'print_form' ), 'page', 'advanced' );
				}
			}
		}

		/**
		 * Print the post editor form.
		 * 
		 * @since 0.1
		 * @access public
		 * @uses edit-form.php
		 */
		static function print_form() {
			include( 'query-form.php' );
		}

		/**
		 * Add KML and KMZ mime types to allowable uploads.
		 */
		static function upload_mimes( $mimes ) {
			$mimes['kml'] = 'application/vnd.google-earth.kml+xml';
			$mimes['kmz'] = 'application/vnd.google-earth.kmz';
			return $mimes;
		}

	}

	ArtHistoryMaps::load();
} // end if class exists

