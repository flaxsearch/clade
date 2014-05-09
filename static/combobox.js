// adapted from http://jqueryui.com/demos/autocomplete/#combobox

(function( $ ) {
	$.widget( "ui.combobox", {
		_create: function() {
			var self = this,
				select = this.element.hide(),
				selected = select.children( ":selected" ),
				value = selected.val() ? selected.text() : "";
			var input = this.input = $( "<input>" ).addClass("ui-state-default")
				.insertAfter( select )
				.val( value )
				.autocomplete({
					delay: 0,
					minLength: 0,
					source: function( request, response ) {
						var matcher = new RegExp( $.ui.autocomplete.escapeRegex(request.term), "i" );
						response( select.children( "option" ).map(function() {
							var text = $( this ).text();
							if ( this.value && ( !request.term || matcher.test(text) ) )
								return {
									label: text.replace(
										new RegExp(
											"(?![^&;]+;)(?!<[^<>]*)(" +
											$.ui.autocomplete.escapeRegex(request.term) +
											")(?![^<>]*>)(?![^&;]+;)", "gi"
										), "<strong>$1</strong>" ),
									value: text,
									option: this
								};
						}) );
					},
					select: function( event, ui ) {
						ui.item.option.selected = true;
						self._trigger( "select", event, {
							valid: true,
							empty: false,
							value: $(ui.item.option).val(),
							label: $(ui.item.option).text()
						});
					},
					change: function( event, ui ) {
						if ( !ui.item ) {
							var matcher = new RegExp( "^" + $.ui.autocomplete.escapeRegex( $(this).val() ) + "$", "i" ), valid = false, value = null, label = null;
							select.children( "option" ).each(function() {
								if ( $( this ).text().match( matcher ) ) {
									this.selected = valid = true;
									value = $(this).val();
									label = $(this).text();
									return false;
								}
							});
							if ( !valid ) {
								self._trigger( "select", event, {
									valid: false,
									empty: input.val() == ""
								});
								return false;
							} else {
								self._trigger( "select", event, {
									valid: true,
									empty: false,
									value: value,
									label: label
								});
								return false;
							}
						}
					},
					open: function( event, ui ) {
						self._trigger( "select", event, {
							valid: false,
							empty: true
						});
					}
				})
				.addClass( "ui-widget ui-widget-content ui-corner-left" );

			input.data( "autocomplete" )._renderItem = function( ul, item ) {
				return $( "<li></li>" )
					.data( "item.autocomplete", item )
					.append( "<a>" + item.label + "</a>" )
					.appendTo( ul );
			};

			this.button = $( "<button type='button'>&nbsp;</button>" )
				.attr( "tabIndex", -1 )
				.attr( "title", "Show All Items" )
				.insertAfter( input )
				.button({
					icons: {
						primary: "ui-icon-triangle-1-s"
					},
					text: false
				})
				.removeClass( "ui-corner-all" )
				.addClass( "ui-corner-right ui-button-icon" )
				.click(function() {
					input.val("");
				
					// close if already visible
					if ( input.autocomplete( "widget" ).is( ":visible" ) ) {
						input.autocomplete( "close" );
						return;
					}

					// work around a bug (likely same cause as #5265)
					$( this ).blur();

					// pass empty string as value to search for, displaying all results
					input.autocomplete( "search", "" );
					input.focus();
				});
		},
		
		hide: function () {
			this.input.hide();
			this.button.hide();
		},
		
		show: function () {
			this.input.show();
			this.button.show();
		},

		destroy: function() {
			this.input.remove();
			this.button.remove();
			this.element.show();
			$.Widget.prototype.destroy.call( this );
		},
		
		label: function() {
			return this.input.val();
		}
	});
})( jQuery );

