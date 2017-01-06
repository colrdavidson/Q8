//jQuery to collapse the navbar on scroll
//jQuery for page scrolling feature - requires jQuery Easing plugin

function fill() {
	var email = atob("Y29saW5AcGVudGFxdWluZS5jb20");
	$('#emaila').prop("href", 'mailto:' + email);
	$('#emaila2').prop("href", 'mailto:' + email);
	$('#email').text(email);
	$('#email2').text(email);
}

$(function() {
	/*
    $('a.page-scroll').bind('click', function(event) {
        var $anchor = $(this);
        $('html, body').stop().animate({
            scrollTop: $($anchor.attr('href')).offset().top
        }, 1500, 'easeInOutExpo');
        event.preventDefault();
    });
	*/
});
