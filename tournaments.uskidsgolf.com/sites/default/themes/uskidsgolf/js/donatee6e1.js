/**
 * @file
 * Responsive menu.
 */
var Drupal = Drupal || {};

(function ($, Drupal) {
    "use strict";

    //TODO: Uncomment this when Donations are fixed.
    //$('.field-name-commerce-donate-amount').hide();

    Drupal.behaviors.donate = {
        attach: function(context) {

            var option = $('select[name="product_id"] option:selected').val();
            if (option != '1' ) {
              //TODO: Uncomment this when Donations are fixed.
                //$('.field-name-commerce-donate-amount').hide();
            }

            $('select[name="product_id"]').on('change', function() {
                $('.field-name-commerce-donate-amount').hide();
                var value = $('select[name="product_id"] option:selected').val();
                if(value == '1') {
                    $('.field-name-commerce-donate-amount').show();
                    $('input[name="line_item_fields[commerce_donate_amount][und][0][value]"]').val('');
                }
                else {
                    $('.field-name-commerce-donate-amount').hide();
                }

            });

            $('form[id^="commerce-cart-add-to-cart-form-4-7-5-6-1"] :submit').click(function(e) {
                var text = parseInt($('select[name="product_id"] option:selected').text().replace('$', ''));
                if (text != undefined && $.isNumeric(text)) {
                    $('input[name="line_item_fields[commerce_donate_amount][und][0][value]"]').val(text);
                }

            });
        }
    };
})(jQuery, Drupal);
