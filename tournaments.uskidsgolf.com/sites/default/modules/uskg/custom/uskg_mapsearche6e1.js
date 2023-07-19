(function($){
  Drupal.behaviors.uskg_mapsearch = {
    attach: function (context, settings) {
      // Whenever the "Search" button in a map filter is clicked
      $(".uskg-map-search .form-submit").live("click", function() {
        // Attempt to geocode the address_search field's value
        geocoder = new google.maps.Geocoder();
        geocoder.geocode({'address': $("#edit-address-search").val()}, function(results, status) {
          // If geocoded successfully, add the latitude and longitude to the form and submit it
          if (status == google.maps.GeocoderStatus.OK) {
            $(".uskg-map-search form").append($("<input/>", {id: "latitude", name: "latitude", type: "hidden", value: results[0].geometry.location.lat()}))
              .append($("<input/>", {id: "longitude", name: "longitude", type: "hidden", value: results[0].geometry.location.lng()}))
              .submit();
          }
          // Else just submit the form as is and we'll let the server handle any necessary geocoding
          else {
            $(".uskg-map-search form").submit();
          }
        });

        // Cancel the normal form post so that the geocode has time to run
        return false;
      });
    }
  };
})(jQuery);
