/**
 *
 */

(function($){
Drupal.behaviors.maps = {
    attach: function (context, settings) {

	// if the empty message exists just move it up
	if($('.view-empty')){
		$('.view-empty').insertAfter( ".view-filters" );
	}	

	$('input[name="distance[search_distance]"]').change(function(){
		if($('input[name="distance[search_distance]"]').val()){
			$("#views-exposed-form-instructors-page").attr("action", "/coaches/find-coach");
		}
	});	

	if(settings.leaflet){
	var map = settings.leaflet[0].lMap;
	var zoomlevel = 10;
	var mapcenter = null;
	//console.log(settings);
	map.on('zoomend', function() {
		zoomlevel = map.getZoom();
		mapcenter = map.getCenter();
		$('input[name="latitude"]').val(mapcenter.lat);
		$('input[name="longitude"]').val(mapcenter.lng);
		$.cookie('latitude', mapcenter.lat);
		$.cookie('longitude', mapcenter.lng);
		// get the miles
		var centerLatLng = map.getCenter(); // get map center
		var pointC = map.latLngToContainerPoint(centerLatLng); // convert to containerpoint (pixels)
		// get the frame height
		var mapHeight = $('.uskg-map-search-attachment .view-content').height();
		var pointY = [pointC.x, pointC.y + (mapHeight/2)]; // add one pixel to y
		// convert containerpoints to latlng's
		var latLngC = map.containerPointToLatLng(pointC);
		var latLngY = map.containerPointToLatLng(pointY);
		var distanceY = latLngC.distanceTo(latLngY); // calculate distance between c and y (longitude)
		var distanceSearch = $('input[name="distance[search_distance]"]').val();
		//console.log(distanceY);
		//console.log(distanceSearch);
		if(distanceSearch  < (distanceY/1000)){
			$('input[name="distance[search_distance]"]').val(distanceY/1000);
			$("#views-exposed-form-instructors-page").submit();
		}
		
		//$("#views-exposed-form-instructors-page").attr("action", "/coaches/find-coach#"+zoomlevel+"/"+mapcenter.lat+"/"+mapcenter.lng);
		//$("#views-exposed-form-instructors-page").submit();
		//$('#edit-submit-instructors').click();
	});
	map.on('dragend', function() {
		zoomlevel = map.getZoom();
		mapcenter = map.getCenter();
		$('input[name="latitude"]').val(mapcenter.lat);
		$('input[name="longitude"]').val(mapcenter.lng);
                $.cookie('latitude', mapcenter.lat);
                $.cookie('longitude', mapcenter.lng);
		//settings.vexpViewsExposedFormInfo.latitude = mapcenter.lat;
		//settings.vexpViewsExposedFormInfo.longitude = mapcenter.lng;
		//$('.uskg-map-search').trigger('views_refresh');
		$("#views-exposed-form-instructors-page").attr("action", "/coaches/find-coach#"+zoomlevel+"/"+mapcenter.lat+"/"+mapcenter.lng);
		$("#views-exposed-form-instructors-page").submit();
	});
	map.on('movestart', function() {
		$('input[name="address_search"]').val('');
		$('input[name="realname"]').val('');
	});
	}
}};

  Drupal.behaviors.accordion = {
    attach: function (context, settings) {
      $(".accordion").accordion({
        active: false,
        collapsible: true
      });
    }
  };

  Drupal.behaviors.bio_expand = {
    attach: function (context, settings) {
      var bio = jQuery(".public-profile .views-field-field-bio .field-content");

      if (bio.height() > 183) {
        bio.append("<span class='read-more'><a href='#'>Continue Reading</a></span>");
        bio.dotdotdot({
          after: ".read-more",
          height: 163
        });
      }

      $(".views-field-field-bio .read-more").on("click", function() {
        bio.trigger("destroy");
        bio.addClass("expanded");
        return false;
      });
    }
  };

  Drupal.behaviors.bookmark = {
    attach: function(context, settings) {
      $(".bookmark-us").live("click", function () {
        title = document.title;
        url = document.location;
        try {
          // Internet Explorer
          window.external.AddFavorite( url, title );
        }
        catch (e) {
          try {
            // Mozilla
            window.sidebar.addPanel( title, url, "" );
          }
          catch (e) {
            // Opera
            if( typeof( opera ) == "object" ) {
              a.rel = "sidebar";
              a.title = title;
              a.url = url;
              return true;
            }
            else {
              // Unknown
              alert("Press Ctrl-D to add page to your bookmarks");
            }
          }
        }
        return false;
      });
    }
  };

  Drupal.behaviors.camp_tables = {
    attach: function (context, settings) {
      $(".camps-table").tablesorter({
        cssAsc: "headerSortUp",
        cssDesc: "headerSortDown",
        cssHeader: "header",
        sortList: [[3,0],[2,0]]
      }).addClass("tablesorter");
    }
  };

  Drupal.behaviors.chosen_other = {
    attach: function (context, settings) {
      $(".field-name-field-other-course, .field-name-field-other-instructor").each(function(index) {
        $(this).addClass("chosen-other");

        if ($(this).find("input").val() == "") {
          $(this).hide();
        }
      });

      $(".chosen-other").prev(".field-widget-entityreference-autocomplete").find(".form-chosen-ajax").on("change", function(event, params) {
        if (params && params.selected != "") {
          $(this).parents(".field-widget-entityreference-autocomplete").next(".chosen-other").hide().find("input").val("");
        }
      }).on("chosen:no_results", function(event, params) {
        input = $(this).siblings(".chosen-container").find("input").val();

        if (input != "") {
          $(this).parents(".field-widget-entityreference-autocomplete").next(".chosen-other").show().find("input").click().focus().val(input);
        }

        return false;
      });
    }
  };

  Drupal.behaviors.ext = {
    attach: function (context, settings) {
      $(".ext a:not([target])").attr("target", "_blank")
    }
  };

  Drupal.behaviors.date_widget = {
    attach: function (context, settings) {
//      $("#edit-field-birthday-und-0-value-date").pickadate({
//        container: 'body',
//        format: 'You selected: yyyy-mm-dd',
//        formatSubmit: 'yyyy-mm-dd',
//        selectYears: true
//      });
    }
  };

  Drupal.behaviors.phone = {
    attach: function (context, settings) {
      $(".field-widget-phone-textfield .form-text").attr("placeholder", "+1 555-555-5555");
    }
  };


  Drupal.behaviors.slider = {
    attach: function (context, settings) {
      if ($.isFunction($.fn.advancedSlider)) {
        $("#responsive-slider").advancedSlider({
          border: "none",
          effectType: "swipe",
          height:300,
          keyboardNavigation: true,
          pauseSlideshowOnHover: true,
          responsive: true,
          shadow: false,
          skin: "glossy-square-gray",
          slideButtons: false,
          slideshow: true,
          swipeThreshold: 30,
          thumbnailButtons: false,
          width: 960
        });
        if(jQuery('meta[property="dc:title"]').attr('about') == '/tournaments/world') {
          jQuery("#block-jquery-countdown-timer-jquery-countdown-timer").prependTo(jQuery('.region-content .field-item.even'));
        }

        if(jQuery('meta[property="dc:title"]').attr('about') == '/welcome-us-kids-golf') {
          jQuery("#block-jquery-countdown-timer-jquery-countdown-timer").prependTo(jQuery('.region-content #block-system-main .block-content'));
        }

        // jQuery to move timer to specific slider graphic
        //jQuery("#block-jquery-countdown-timer-jquery-countdown-timer").prependTo(jQuery('img[alt="2014 World Championship"]').parent());
      }
    }
  };


  Drupal.behaviors.jquery_coundown_timer_init_popup = {
    attach: function(context, settings) {
      if (Drupal.settings.jquery_countdown_timer) {
        var note = $('#jquery-countdown-timer-note'),
        ts = new Date(Drupal.settings.jquery_countdown_timer.jquery_countdown_timer_date * 1000);
        $('#jquery-countdown-timer').not('.jquery-countdown-timer-processed').addClass('jquery-countdown-timer-processed').countdown({
          timestamp: ts,
          callback: function() {
            var message = Drupal.t('<span class="days">Days</span> <span class="hours">Hours</span> <span class="minutes">Minutes</span> <span class="seconds">Seconds</span>');
            note.html(message);
          }
        });
      }
    }
  }

})(jQuery);


