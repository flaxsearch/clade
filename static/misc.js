(function($) {

    /**
     * Miscellaneous functions.
     */

    /**
     * Disable browser default selection behaviour.
     */
    $.fn.disableSelection = function() {
        return this.each(function() {           
            $(this).attr('unselectable', 'on')
                   .css({
                       '-moz-user-select':'none',
                       '-webkit-user-select':'none',
                       'user-select':'none',
                       '-ms-user-select':'none'
                   })
                   .each(function() {
                       this.onselectstart = function() { return false; };
                   });
        });
    };
})(jQuery);

