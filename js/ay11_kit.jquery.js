/*! Author: Patrick Fox
*   https://github.com/patrickfox/a11y_kit
*/
(function() {
  var announce_timeout, focusable, visible;

  $.fn.access = function(place_focus_before) {
    var ogti, target, temp_em;
    if (place_focus_before) {
      temp_em = $('<span />');
      temp_em.insertBefore(this);
      temp_em.attr('tabindex', '-1').on('blur focusout', function() {
        return $(this).remove();
      }).focus();
    } else {
      ogti = 'original-tabindex';
      target = $(this);
      target.data(ogti, target.attr('tabindex') || false);
      target.attr('tabindex', '-1').on('blur focusout', function() {
        if (target.data(ogti) !== false) {
          return target.attr('tabindex', target.data(ogti));
        } else {
          target.removeAttr('tabindex');
          target.off('blur focusout');
          return target.data(ogti, false);
        }
      }).focus();
    }
    return this;
  };

  announce_timeout = null;

  $.announce = function(message, manner) {
    var announcer, clear_announcer;
    manner = manner || 'polite';
    announcer = $('#a11y_announcer').attr('aria-live', 'off');
    clear_announcer = function() {
      announcer.html('');
      announce_timeout = null;
    };
    announcer.attr('aria-live', manner);
    announcer.html(message);
    clearTimeout(announce_timeout);
    announce_timeout = setTimeout(clear_announcer, 500);
    return this;
  };

  visible = function(element) {
    return $.expr.filters.visible(element) && !$(element).parents().addBack().filter(function() {
      return $.css(this, 'visibility') === 'hidden';
    }).length;
  };

  focusable = function(element, isTabIndexNotNaN) {
    var img, map, mapName, nodeName;
    nodeName = element.nodeName.toLowerCase();
    if ('area' === nodeName) {
      map = element.parentNode;
      mapName = map.name;
      if (!element.href || !mapName || map.nodeName.toLowerCase() !== 'map') {
        return false;
      }
      img = $('img[usemap=#' + mapName + ']')[0];
      return !!img && visible(img);
    }
    return (/input|select|textarea|button|object/.test(nodeName) ? !element.disabled : 'a' === nodeName ? element.href || isTabIndexNotNaN : isTabIndexNotNaN) && visible(element);
  };

  $.extend($.expr[':'], {
    data: ($.expr.createPseudo ? $.expr.createPseudo(function(dataName) {
      return function(elem) {
        return !!$.data(elem, dataName);
      };
    }) : function(elem, i, match) {
      return !!$.data(elem, match[3]);
    }),
    focusable: function(element) {
      return focusable(element, !isNaN($.attr(element, "tabindex")));
    },
    tabbable: function(element) {
      var isTabIndexNaN, tabIndex;
      tabIndex = $.attr(element, "tabindex");
      isTabIndexNaN = isNaN(tabIndex);
      return (isTabIndexNaN || tabIndex >= 0) && focusable(element, !isTabIndexNaN);
    }
  });

}).call(this);
