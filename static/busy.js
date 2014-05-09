(function($) {

    /**
     * jQuery UI widget that adds a busy-wait icon to an element.
     */

	$.widget("ui.busy", {
	    /**
	     * Options are:
	     *
	     *  src  - path to image src
	     *  bind - prefix for busystart, busyend events
	     */
		options: { src: "/static/images/ajax.gif", bind: "" },

        /**
         * Create the widget by adding an intially hidden busy icon to the
         * element. Event handlers bound to busystart and busywait show and
         * hide the icon.
         */
		_create: function () {
			var icon = $("<div>").css({ "background-image": "url('" + this.options.src + "')", "background-repeat": "no-repeat", "background-position": "center", "position": "absolute", "width": "100%", "height": "100%", "top": 0, "left": 0 }).hide();
			this.element.append(icon);
			this.element.bind(this.options.bind + "busystart", function () {
			    icon.show();
			});
			this.element.bind(this.options.bind + "busyend", function () {
			    icon.hide();
			});
		},

        /**
         * Restore initial element state.
         */
		destroy: function () {
		    this.icon.remove();
			$.Widget.prototype.destroy.call(this);
		}
	});
})(jQuery);

