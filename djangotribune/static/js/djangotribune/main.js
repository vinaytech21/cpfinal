/*
* The Django-tribune jQuery plugin
* 
* TODO: This lack of :
*       * Use the header "X-Post-Id" to retrieve owned message posted and enable owner 
*         mark for anonymous;
*       * "clock_store" cleaning when dropping messages from the list
*       * User settings panel;
*       * Think about themes usage;
*/
DEBUG = false; // To enable/disable message logs with "console.log()"

// Array Remove - By John Resig (MIT Licensed)
Array.prototype.remove = function(from, to) {
    var rest = this.slice((to || from) + 1 || this.length);
    this.length = from < 0 ? this.length + from : from;
    return this.push.apply(this, rest);
};

/* 
 * The djangotribune plugin
 * 
 * Usage for first init :
 * 
 *     $(".mycontainer").djangotribune({options...});
 */
(function($){
    /*
     * Plugin extensions calling logic
     */
    $.fn.djangotribune = function(method) {
        if ( extensions[method] ) {
            return extensions[method].apply( this, Array.prototype.slice.call( arguments, 1 ));
        } else if ( typeof method === 'object' || ! method ) {
            return extensions.init.apply( this, arguments );
        } else {
            $.error( 'Method ' +  method + ' does not exist on jQuery.djangotribune' );
        }
    };
    
    
    
    /*
     * Timer methods and registries
     */
    var Timer = {
        timers : {},
        /*
        * Get the timer from registry
        */
        getTimer : function(key) {
            var timerObj;
            try {
                timerObj = this.timers[key];
            } catch (e) {
                timerObj = null;
            }
            return timerObj;
        },
        /*
        * Stop timer
        */
        stopTimer : function(key) {
            var timerObj = this.getTimer(key);
            if (timerObj !== null) {
                if(DEBUG) console.log("Timer '"+key+"' cleared");
                clearInterval(timerObj);
                this.timers[key] = null;
            }
        },
        /*
        * Set a new timer
        */
        setTimer : function(key, funcString, milliseconds, force_zero) {
            if( typeof(milliseconds) != "number" ) milliseconds = parseInt(milliseconds);
            this.stopTimer(key); // Clear previous clearInterval from memory
            if(DEBUG) console.log("Timer '"+key+"' setted for "+milliseconds+" milliseconds");
            this.timers[key] = setTimeout(funcString, milliseconds);
        }
    };
    
    

    /*
     * Plugin extension methods
     */
    var extensions = {
        /*
         * Expose some debug infos
         */
        debug : function() {
            return this.each(function(){
                var $this = $(this),
                    data = $this.data("djangotribune"),
                    key = data.key;
                    
                console.log("'clock store' debug output");
                console.log( "@@ _index_ids @@" );
                console.log( clock_store._index_ids[key] );
                console.log( "@@ _index_timestamps @@" );
                console.log( clock_store._index_timestamps[key] );
                console.log( "@@ _index_dates @@" );
                console.log( clock_store._index_dates[key] );
                console.log( "@@ _index_clocks @@" );
                console.log( clock_store._index_clocks[key] );
                console.log( "@@ _count_timestamp @@" );
                console.log( clock_store._count_timestamp[key] );
                console.log( "@@ _count_short_clock @@" );
                console.log( clock_store._count_short_clock[key] );
                console.log( "@@ _index_user_ids @@" );
                console.log( clock_store._index_user_ids[key] );
                console.log( "@@ _index_user_timestamps @@" );
                console.log( clock_store._index_user_timestamps[key] );
                console.log( "@@ _index_user_clocks @@" );
                console.log( clock_store._index_user_clocks[key] );
                console.log( "@@ _map_clock @@" );
                console.log( clock_store._map_clock[key] );
                console.log( "@@ _map_clockids @@" );
                console.log( clock_store._map_clockids[key] );
            });
        },
        
        /*
         * Initialize plugin, must be called first
         */
        init : function(options) {
            // Default for DjangoCodeMirror & CodeMirror
            var settings = $.extend( {
                "host" : '',
                "remote_path": '',
                "post_path": '',
                "channel": null,
                "clockfinder_path": '',
                "theme": 'default',
                "message_limit": 30,
                "refresh_active": true,
                "refresh_time_shifting": 10000,
                "authenticated_username": null,
                "urlopen_blank": true,
                "shortcut_map": {
                    "bold": ["b", "b", function(s){ return "<b>"+s+"</b>" }],
                    "italic": ["i", "i", function(s){ return "<i>"+s+"</i>" }],
                    "stroke": ["s", "s", function(s){ return "<s>"+s+"</s>" }],
                    "underline": ["u", "u", function(s){ return "<u>"+s+"</u>" }],
                    "teletype": ["tt", "t", function(s){ return "<tt>"+s+"</tt>" }],
                    "code": ["code", "c", function(s){ return "<code>"+s+"</code>" }],
                    "moment": ["m", "m", function(s){ return "<m>"+s+"</m>" }]
                }
            }, options);
            
            // Build DjangoTribune for each selected element
            return this.each(function() {
                var $this = $(this),
                    djangotribune_key = "djangotribune-id-" + (settings.channel||'default'), // djangotribune instance ID, must be unique, reference to the current channel if any
                    djangotribune_scroll = $("<div class=\"djangotribune_scroll\"></div>").insertBefore("form", $this).append($("ul.messages", $this)),
                    refresh_input = templates.refresh_checkbox(settings).insertBefore("form .input-column .ctrlHolder", $this),
                    shortcut_bar = $("<div class=\"djangotribune_shortcut_bar row collapse\"></div>").insertBefore("form *:first", $this),
                    // REFRESH INDICATOR display
                    refresh_indicator = {
                        start: function(instance){
                            $("input.content_field", instance).removeClass("backend-refresh-error").addClass("backend-refresh-spinner");
                        },
                        stop: function(instance){
                            $("input.content_field", instance).removeClass("backend-refresh-spinner");
                        },
                        error: function(instance){
                            $("input.content_field", instance).removeClass("backend-refresh-spinner").addClass("backend-refresh-error");
                        },
                    },
                    // SUBMIT INDICATOR display
                    submit_indicator = {
                        start: function(instance){
                            $("input.content_field", instance).removeClass("error").addClass("disabled");
                        },
                        stop: function(instance){
                            $("input.content_field", instance).removeClass("disabled");
                        },
                        error: function(instance){
                            $("input.content_field", instance).removeClass("disabled").addClass("error");
                            $("input.content_field", instance).removeClass("disabled").addClass("error");
                        },
                    },
                    absolute_container = $('<div class="absolute-message-container"><div class="content"></div></div>').css({"display": "none"}).appendTo("body"),
                    extra_context = {};
                
                // Attach element's data
                $this.data("djangotribune", {
                    "djangotribune": $this,
                    "key": djangotribune_key,
                    "scroller": djangotribune_scroll,
                    "refresh_input": refresh_input.find('input'),
                    "refresh_indicator": refresh_indicator,
                    "submit_indicator": submit_indicator,
                    "absolute_container": absolute_container,
                    "settings": settings
                });
                $this.data("djangotribune_lastid", 0);
                
                // Open a new store for the current channel
                clock_store.new_store(djangotribune_key);
                
                // Default Ajax request settings
                $.ajaxSetup({
                    global: false,
                    type: "GET",
                    dataType: "json",
                    beforeSend: CSRFpass,
                    ifModified: true,
                    cache: false
                });
                
                // Bind djangotribune's specific events
                extra_context.djangotribune = $this;
                $(window).bind("update_backend_display.djangotribune", events.update);
                refresh_input.find('input').change(extra_context, events.change_refresh_active);
                $("form input[type='submit']", $this).click(extra_context, events.submit);
                $("input.content_field", $this).keydown(extra_context, function(e){
                    if(e.keyCode == '13'){
                        e.stopPropagation();
                        return events.submit(e);
                    }
                    return true;
                });
                $("form", $this).bind("submit", function() { return false; });
                
                // Bind keyboard shortcuts for syntax from the map
                $.each(settings.shortcut_map, function(index, row) {
                    $("input.content_field", $this).bind('keydown', jwerty.event('alt+'+row[1], events.shortcut_key, [index, $this]));
                    // Add a button in bar to simulate shortcut key on button click
                    $('<a class="'+index+'" title="alt+'+row[1]+'">'+row[0]+'</a>').appendTo(shortcut_bar).click(function(){
                        jwerty.fire('alt+'+row[1], "input.content_field", $this);
                        return false;
                    });
                });
                // First parsing from html
                $this.djangotribune('initial');
            });
        },
        
        
        /*
         * Parse HTML message list as initial backend, index/store their data and update 
         * the last_id
         */
        initial : function() {
            return this.each(function(){
                var $this = $(this),
                    data = $this.data("djangotribune"),
                    last_id = $this.data("djangotribune_lastid"),
                    currentid = 0,
                    owned;
                
                $(".djangotribune_scroll li.message", $this).each(function(index) {
                    currentid = parseInt( $(this).attr("data-tribune-pk") );
                    
                    // Break to avoid doublet processing
                    if( last_id >= currentid  ) return false;
                    
                    // Chech message author identity
                    var identity_username = null;
                    if( $("span.identity", this).hasClass('authenticated') ) {
                        identity_username = $("span.identity", this).html();
                    }
                    // Compile message datas as a message object
                    var message_data = {
                        "id": currentid,
                        "created": $(this).attr("data-tribune-created"),
                        "clock": $("span.clock", this).text(),
                        "clock_indice": parseInt( $(this).attr("data-tribune-clock_indice") ),
                        "clockclass": $(this).attr("data-tribune-clockclass"),
                        "user_agent": $("span.identity", this).attr('title'),
                        "author__username": identity_username,
                        "owned": ($(this).attr("data-tribune-owned") && $(this).attr("data-tribune-owned")=="true") ? true : false,
                        "web_render": $("span.content", this).html()
                    };
            
                    // Store the clock
                    clock_store.add(data.key, message_data.created, message_data.clock_indice, message_data.owned);
                    
                    // Detect /me action
                    if(message_data.author__username && message_data.web_render.search(/^\/me /) >= 0){
                        $(this).addClass('me-action');
                        $("span.content", this).html(message_data.web_render.replace(/^\/me /, ''));
                    }
                    
                    // Put data in clock/timestamp/etc.. register and initialize 
                    // events (clock, links, totoz, etc..) on rows
                    events.bind_message($this, data, this, message_data, true);
                });
                
                // First timer init
                if(data.settings.refresh_active){
                    Timer.setTimer(data.key, function(){ $this.djangotribune('refresh'); }, data.settings.refresh_time_shifting);
                }
                
                // Push the last message id as reference for next backend requests
                $this.data("djangotribune_lastid", currentid);
            });
        },
        
        /*
         * Get the fucking backend
         */
        refresh : function(options) {
            return this.each(function(){
                var $this = $(this),
                    data = $this.data("djangotribune"),
                    last_id = $this.data("djangotribune_lastid"),
                    query = $.QueryString,
                    refresh_indicator = data.refresh_indicator;
                    
                // Custom options if any
                options = options||{};
                
                // Check custom last_id
                if(options.last_id) {
                    last_id = options.last_id;
                }
                query.last_id = last_id;
                
                // Custom settings on the fly if any
                current_settings = data.settings;
                if(options.extra_settings){
                    current_settings = $.extend({}, current_settings, options.extra_settings);
                }
                
                // Perform request to fetch backend
                var url = CoreTools.get_request_url(current_settings.host, current_settings.remote_path, query);
                if(DEBUG) console.log("Djangotribune refresh on : "+url);
                $.ajax({
                    url: url,
                    data: {},
                    beforeSend: function(req){
                        refresh_indicator.start($this);
                    },
                    success: function (backend, textStatus) {
                        if(DEBUG) console.log("Djangotribune Request textStatus: "+textStatus);
                        refresh_indicator.stop($this);
                        
                        if(textStatus == "notmodified") return false;
                        
                        // Send signal to update messages list with the fetched backend 
                        // if there are at least one row
                        if(backend.length>0) {
                            $this.trigger("update_backend_display", [data, backend, last_id]);
                        }
                    },
                    error: function(XMLHttpRequest, textStatus, errorThrown){
                        if(DEBUG) console.log("Djangotribune Error request textStatus: "+textStatus);
                        if(DEBUG) console.log("Djangotribune Error request errorThrown: "+textStatus);
                        refresh_indicator.error($this);
                    },
                    complete: function (XMLHttpRequest, textStatus) {
                        // Relaunch timer
                        if(data.settings.refresh_active){
                            Timer.setTimer(data.key, function(){ $this.djangotribune('refresh'); }, data.settings.refresh_time_shifting);
                        }
                    }
                });
            });
        }
    };
    
    
    
    /*
     * Plugin event methods
     */
    var events = {
        /*
         * Update HTML to append new messages from the given backend data
         * This should not be used if there are no message in backend
         */
        update : function(event, data, backend, last_id, options) {
            var element,
                element_ts,
                $this = $(event.target),
                current_message_length = $(".djangotribune_scroll li", $this).length;
            
            if(DEBUG) console.log("Djangotribune events.update");
 
            // Drop the notice for empty lists
            $(".djangotribune_scroll li.notice.empty", $this).remove();
 
            // Custom options if any
            options = options||{};
            current_settings = data.settings;
            if(options.extra_settings){
                current_settings = $.extend({}, current_settings, options.extra_settings);
            }
            // Get the current knowed last post ID
            last_id = $this.data("djangotribune_lastid");
            
            $.each(backend, function(index, row) {
                // Drop the oldiest item if message list has allready reached the 
                // display limit
                // TODO: This should drop also item clocks references from the 
                // "clock_store" (to avoid too much memory usage)
                if (current_message_length >= data.settings.message_limit) {
                    $(".djangotribune_scroll li", $this).slice(0,1).remove();
                }
            
                // Register the message in the clock store
                element_ts = clock_store.add(data.key, row.created, null, row.owned);
                // Update clock attributes from computed values by the clock store
                row.clock_indice = element_ts.indice;
                row.clockclass = clock_store.clock_to_cssname(element_ts.clock);
                
                // Compute some additionals row data
                row = CoreTools.compute_extra_row_datas(row);
                // Compile template, add its result to html and attach it his data
                element = $( templates.message_row(row) ).appendTo( $(".djangotribune_scroll ul", $this) ).data("djangotribune_row", row);
                // Bind all related message events
                events.bind_message($this, data, element, row);
                
                // Update to the new last_id
                last_id = row.id;
            });
            
            // Push the last message id as reference for next backend requests
            $this.data("djangotribune_lastid", last_id);
        },
 
        /*
         * Change the settings "refresh_active" from the checkbox
         * TODO: This should be memorized in a cookie or something else more persistent 
         * (like user personnal settings) instead of local variables in a page instance
         */
        change_refresh_active : function(event) {
            var $this = $(event.data.djangotribune),
                data = $this.data("djangotribune");
            
            if(DEBUG) console.log("Djangotribune events.change_refresh_active");
            
            if( data.refresh_input.is(':checked') ){
                // Enable refresh
                Timer.setTimer(data.key, function(){ $this.djangotribune('refresh'); }, data.settings.refresh_time_shifting);
                data.settings.refresh_active = true;
            } else {
                // Disable refresh
                Timer.stopTimer(data.key);
                data.settings.refresh_active = false;
            }
            
            // Update settings
            $this.data("djangotribune", data);
            
            return true;
        },

        /*
         * Submit form to post content
         */
        submit : function(event) {
            var $this = $(event.data.djangotribune),
                data = $this.data("djangotribune"),
                last_id = $this.data("djangotribune_lastid"),
                submit_indicator = data.submit_indicator,
                query = $.QueryString;
            
            if(DEBUG) console.log("Djangotribune events.submit");
 
            var content_value = $("input.content_field", $this).val();
            
            if(!content_value || content_value.length<1) return false;
            
            query.last_id = last_id;
            
            // Perform request to fetch backend
            var url = CoreTools.get_request_url(data.settings.host, data.settings.post_path, query);
            if(DEBUG) console.log("Djangotribune posting on : "+url);
            $.ajax({
                type: "POST",
                url: url,
                data: {"content": content_value},
                beforeSend: function(req){
                    // Stop timer and put display marks on content field input
                    Timer.stopTimer(data.key);
                    $("form input[type='submit']", $this).attr("disabled", "disabled");
                    submit_indicator.start();
                },
                success: function (backend, textStatus) {
                    if(DEBUG) console.log("Djangotribune Request textStatus: "+textStatus);
                   
                    submit_indicator.stop();
                    $("input.content_field", $this).val("");
                        
                    if(textStatus == "notmodified") return false;
                    
                    // Send signal to update messages list with the fetched backend 
                    // if there are at least one row
                    if(backend.length>0) {
                        $this.trigger("update_backend_display", [data, backend, last_id]);
                    }
                },
                error: function(XMLHttpRequest, textStatus, errorThrown){
                    if(DEBUG) console.log("Djangotribune Error request textStatus: "+textStatus);
                    if(DEBUG) console.log("Djangotribune Error request errorThrown: "+textStatus);
                    submit_indicator.error();
                },
                complete: function (XMLHttpRequest, textStatus) {
                    $("form input[type='submit']", $this).removeAttr("disabled");
                    // Relaunch timer
                    if(data.settings.refresh_active){
                        Timer.setTimer(data.key, function(){ $this.djangotribune('refresh'); }, data.settings.refresh_time_shifting);
                    }
                }
            });
            
            return false;
        },

        /*
         * Bind message events and add some sugar on message HTML
         */
        bind_message : function(djangotribune_element, djangotribune_data, message_element, message_data, initial) {
            var preload,
                clock,
                input_sel,
                pointer_name,
                clock_name,
                css_attrs,
                initial = (initial) ? true : false,
                // TODO: move in the djangotribune data
                // NOTE: initial HTML use entity reference and JSON backend use decimal 
                // reference, so for now we need to support both of them
                regex_cast_initial = new RegExp(djangotribune_data.settings.authenticated_username+"&#60;"),
                regex_cast_backend = new RegExp(djangotribune_data.settings.authenticated_username+"&lt;");
            
            // Add event to force URL opening in a new window
            $("span.content a", message_element).click( function() {
                window.open($(this).attr("href"));
                return false;
            });

            // Smiley images
            $("span.content a.smiley", message_element).each(function(index) {
                preload = new Image();
                preload.src = $(this).attr("href");
            }).mouseenter(
                {"djangotribune": djangotribune_element}, events.display_smiley
            ).mouseleave( function() {
                $("p.smiley_container").remove();
            });
            
            // Add flat clock as a class name on pointers
            $("span.content span.pointer", message_element).each(function(index) {
                $(this).addClass("pointer_"+clock_store.plainclock_to_cssname($(this).text()));
            });
            
            // Broadcasting
            if( message_data.web_render.toLowerCase().search(/moules&lt;/) != -1 || message_data.web_render.toLowerCase().search(/moules&#60;/) != -1 ){
                // Global mussles broadcasting
                $(message_element).addClass("musslecast");
                $('span.marker', message_element).html("<i class=\"icon-bullhorn\"></i>")
            } else if ( djangotribune_data.settings.authenticated_username && ( message_data.web_render.toLowerCase().search( regex_cast_initial ) != -1 || message_data.web_render.toLowerCase().search( regex_cast_backend ) != -1 ) ){
                // User broadcasting
                $(message_element).addClass("usercast");
                $('span.marker', message_element).html("<i class=\"icon-bullhorn\"></i>")
            }
                
            // Message reference clock
            $("span.clock", message_element).mouseenter(function(){
                // Get related pointers in all messages and highlight them
                $(this).parent().addClass("highlighted");
                pointer_name = "pointer_"+clock_store.plainclock_to_cssname(jQuery.trim($(this).text()));
                $("li.message span.pointer."+pointer_name, djangotribune_element).each(function(index) {
                    $(this).addClass("highlighted");
                    $(this).parent().parent().addClass("highlighted");
                });
            }).mouseleave(function(){
                // Get related pointers and un-highlight them
                $(this).parent().removeClass("highlighted");
                pointer_name = "pointer_"+clock_store.plainclock_to_cssname(jQuery.trim($(this).text()));
                $("li.message span.pointer."+pointer_name, djangotribune_element).each(function(index) {
                    $(this).removeClass("highlighted");
                    $(this).parent().parent().removeClass("highlighted");
                });
            }).click(function(){
                // Add clicked clock at input cursor position then focus after 
                // the clock position
                clock = jQuery.trim($(this).text());
                input_sel = $("#id_content").textrange('get');
                $("#id_content").textrange('insert', clock+" ").textrange('setcursor', input_sel.position+clock.length+1);
            });
            
            // Clock pointers contained
            $("span.content span.pointer", message_element).mouseout(function(){
                
                $(this).removeClass("highlighted");
                // Get related pointers and un-highlight them
                pointer_name = "pointer_"+clock_store.plainclock_to_cssname(jQuery.trim($(this).text()));
                $("li.message span.pointer."+pointer_name, djangotribune_element).each(function(index) {
                    $(this).removeClass("highlighted");
                });
                // Get related messages and un-highlight them
                clock_name = "msgclock_"+clock_store.plainclock_to_cssname(jQuery.trim($(this).text()));
                $("li."+clock_name, djangotribune_element).each(function(index) {
                    $(this).removeClass("highlighted");
                });
                
                // Allways empty the absolute display container
                // NOTE: Mouseout event seems to be throwed to soon in some case like with the 
                // clock out of history feature. The absolute_container seems to be created AFTER 
                // the mouseout event is throwed. (to confirm)
                djangotribune_data.absolute_container.html("").hide();
                
            }).mouseover(function(){
                
                var $this_pointer = $(this),
                    clock_pointer = jQuery.trim($this_pointer.text()),
                    _clock_pointer_match_count = 0;
                $this_pointer.addClass("highlighted");
                
                // Get related pointers in all messages and highlight them
                pointer_name = "pointer_"+clock_store.plainclock_to_cssname(clock_pointer);
                $("li.message span.pointer."+pointer_name, djangotribune_element).each(function(index) {
                    $(this).addClass("highlighted");
                });
                
                // Get related messages and highlight them
                clock_name = "msgclock_"+clock_store.plainclock_to_cssname(clock_pointer);
                if(DEBUG) console.info("Clock pointer hover for: %s", clock_name);
                $("li."+clock_name, djangotribune_element).each(function(index) {
                    _clock_pointer_match_count += 1;
                    $(this).addClass("highlighted");
                    if(DEBUG) {
                        console.group("Pointer event for message: %s", clock_pointer)
                        console.log("Window scrollTop: "+ $(window).scrollTop());
                        console.log("Pointer offset: "+ $this_pointer.offset().top);
                        console.log("Reference offset from pointer: "+ $(this).offset().top);
                    }
                    // Display messages that are out of screen
                    if($(window).scrollTop() > $(this).offset().top) {
                        events.display_message_popin(djangotribune_data, $this_pointer, $(this).html());
                    }
                    if(DEBUG) console.groupEnd();
                });
                // So there is no matched clock in the current history.. what if we try 
                // to find them out of the history ?
                //if(DEBUG) console.info("Clock pointer matched: %s", _clock_pointer_match_count);
                if(_clock_pointer_match_count == 0){
                    if(DEBUG) console.warn("No matched clock %s in current history", clock_pointer);
                    var today = new Date(),
                        item_id = today.getFullYear().toString() + today.getMonth().toString() + today.getDay().toString() + clock_store.plainclock_to_cssname(clock_pointer),
                        url = CoreTools.get_request_url(djangotribune_data.settings.host, djangotribune_data.settings.clockfinder_path).replace(/00:00\//,clock_pointer+"/"),
                        html = "";
                    if(DEBUG) console.info("Trying to find clock '%s' (id=%s) on url : %s", clock_pointer, item_id, url);
                    $.ajax({
                        cache: true,
                        url: url,
                        data: {},
                        success: function (backend, textStatus) {
                            if(DEBUG) console.log("Djangotribune Request textStatus: "+textStatus);
                            
                            if(textStatus == "notmodified"){
                                // Fill "backend" with cache value for the item_id
                                backend = backends_store[item_id];
                            } else {
                                // Fill item_id cache with the backend
                                backends_store[item_id] = backend;
                            }
                            if(backend.length==0) return false;
                            
                            $.each(backend, function(index, row) {
                                row = CoreTools.compute_extra_row_datas(row);
                                html += templates.message_row(row, true);
                            });
                            events.display_message_popin(djangotribune_data, $this_pointer, "<ul>"+html+"</ul>");
                        },
                        error: function(XMLHttpRequest, textStatus, errorThrown){
                            if(DEBUG) console.log("Djangotribune Error request textStatus: "+textStatus);
                            if(DEBUG) console.log("Djangotribune Error request errorThrown: "+textStatus);
                        }
                    });
                }
                
            });
            
            // Mark answers for current user
            // TODO: this use "simple" clocks as references without checking, so this 
            //       will also mark same clock from another day if they are somes in 
            //       history
            $("span.content span.pointer", message_element).each( function(i){
                if( clock_store.is_user_clock(djangotribune_data.key, $(this).text()) ) {
                    $(this).addClass("pointer-answer").parent().parent().addClass("answer").find('span.marker').html("<i class=\"icon-bubble\"></i>");
                }
            });
        },
 
        /*
         * Replace selected text with some method attached to shortcut key
         */
        shortcut_key : function(event, code) {
            event.preventDefault();
            
            var $this = this[1],
                data = $this.data("djangotribune"),
                method_name = this[0],
                sel = $("input.content_field", $this).textrange('get'),
                tagged_text = data.settings.shortcut_map[method_name][2](sel.text),
                pos_diff = tagged_text.length - sel.length;
            
            $("input.content_field", $this).textrange('replace', tagged_text);
            $('input.content_field').textrange('setcursor', sel.end+pos_diff);
        },
 
        /*
         * Display the smiley in a "bubble tip" positionned from the element
         */
        display_smiley : function(event) {
            var $this = $(event.target),
                djangotribune_element = event.data.djangotribune,
                url = $this.attr("href"),
                alt = ($this.attr("alt")||''),
                top_offset = ($this.offset().top + $this.outerHeight()),
                left_offset = ($this.offset().left + $this.outerWidth()),
                bottom_screen_pos = $(document).scrollTop() + $(window).height(),
                image_height,
                bottom_image_pos,
                container;
            // Remove all previous smiley if any
            $("p.smiley_container", djangotribune_element).remove();
            // Build container positionned at the bottom of the element source
            container = $("<p class=\"smiley_container\"><img src=\""+ url +"\" alt=\""+ (alt||'') +"\"/>"+"</p>").css({
                "height": "",
                "position":"absolute",
                "padding":"0",
                "top": top_offset+"px",
                "bottom": "",
                "left": left_offset+"px"
            }).prependTo("body");
            
            // By default the image is positionned at the bottom of the element, but 
            // if its bottom corner is "out of screen", we move it at the top of element.
            image_height = container.height();
            bottom_image_pos = top_offset + image_height;
            if(bottom_image_pos > bottom_screen_pos) {
                top_offset = top_offset-image_height-$this.outerHeight();
                container.css("height", image_height+"px").css("top", top_offset).css("bottom", "");
            }
        },

        /*
        * Display message(s) in an absolute pop-in
         */
        display_message_popin : function(djangotribune_data, pointer, html) {
            // Append html now so we can know about his future height
            djangotribune_data.absolute_container.html( html );
            css_attrs = { "left":djangotribune_data.scroller.offset().left };
            // Calculate the coordinates of the bottom container displayed 
            // at top by default
            var container_bottom_position = $(window).scrollTop() + djangotribune_data.absolute_container.outerHeight(true);
            
            // Display at top of the screen by default
            if( pointer.offset().top > container_bottom_position) {
                css_attrs.top = 0;
                css_attrs.bottom = "";
                djangotribune_data.absolute_container.removeClass("at-bottom").addClass("at-top");
                if(DEBUG) console.info("Absolute display at top");
            // Display at bottom of the screen
            } else {
                css_attrs.top = "";
                css_attrs.bottom = 0;
                djangotribune_data.absolute_container.removeClass("at-top").addClass("at-bottom");
                if(DEBUG) console.info("Absolute display at bottom");
            }
            // Apply css position and show it
            djangotribune_data.absolute_container.css(css_attrs).show();
        }
    };
    
    
    /*
     * Backends store
     * 
     * Store fetched backend from special method like clock finding
     * 
     * This is not for storing all the fetched backend by the refresh event.
     * 
     * Backends are store on their id that is a full timestamp
     */
    var backends_store = {
        _map_backends : {}
    };
    
    
    /*
     * Clock date store
     * 
     * Should know about any clock/timestamp with some facilities to get various format, 
     * append new item, remove them(?) and an minimal interface to search on items
     * 
     * Items ID are internal timestamps, this is a concat of the date, the time and the indice like that :
     * 
     *  YYYYMMDD+hhmmss+i
     * 
     */
    var clock_store = {
        _indices : '¹²³⁴⁵⁶⁷⁸⁹', // Exposant indices characters map
 
        _index_keys : [], // registry keys, each key store his own stuff, values between key stores are never related
        _index_ids : {}, // IDs are internal timestamp 
        _index_timestamps : {}, // timestamp that represents clocks in a full date format
        _index_dates : {}, // dates, NOTE: should be removed
        _index_clocks : {}, // clocks
        _index_user_ids : {}, // ids owned by the current user
        _index_user_timestamps : {}, // timestamps owned by the current user
        _index_user_clocks : {}, // clocks owned by the current user
 
        _map_clock : {}, // a map indexed on clocks, with all their timestamps as values, each clock can have multiple timestamp
        _map_clockids : {}, // a map indexed on clocks, with all their ids as values, each clock can have multiple ids
 
        _count_timestamp : {}, // Timestamps count
        _count_short_clock : {}, // Short clock count
 
        /*
        * New registry initialization
        */
        'new_store' : function(key) {
            this._index_keys.push(key);
            this._index_ids[key] = [];
            this._index_timestamps[key] = [];
            this._index_dates[key] = [];
            this._index_clocks[key] = [];
            this._index_user_ids[key] = [];
            this._index_user_timestamps[key] = [];
            this._index_user_clocks[key] = [];
            
            this._map_clock[key] = {};
            this._map_clockids[key] = {};
            
            this._count_timestamp[key] = {};
            this._count_short_clock[key] = {};
        },
        
        /*
        * Add a timestamp entry to a key store
        * 
        * NOTE: Shouldn't be an "id" as argument instead of a "timestamp" ??
        */
        'add' : function(key, timestamp, indice, user_owned) {
            var indice = (indice) ? indice : this.get_timestamp_indice(key, timestamp),
                id = timestamp+this.lpadding(indice),
                clock = this.timestamp_to_full_clock(timestamp, indice),
                short_clock = this.timestamp_to_short_clock(timestamp),
                date = this.timestamp_to_date(timestamp);
            
            //console.log("ADDING= key:"+key+"; timestamp:"+timestamp+"; indice:"+indice+"; user_owned:"+user_owned+";");
            
            // Indexing EVERYTHING !
            if(this._index_dates[key].indexOf(date) == -1) this._index_dates[key].push(date);
            
            if(this._index_ids[key].indexOf(id) == -1) this._index_ids[key].push(id);
            
            if(this._index_timestamps[key].indexOf(timestamp) == -1) this._index_timestamps[key].push(timestamp);
 
            if(this._index_clocks[key].indexOf(clock) == -1) this._index_clocks[key].push(clock);
            if(this._index_clocks[key].indexOf(short_clock) == -1) this._index_clocks[key].push(short_clock);
            
            // Count TIMESTAMP=>COUNT
            if(!this._count_timestamp[key][timestamp]) this._count_timestamp[key][timestamp] = 0; // if array doesnt allready exist, create it
            this._count_timestamp[key][timestamp] += 1;
            
            // Count SHORT_CLOCK=>COUNT
            if(!this._count_short_clock[key][short_clock]) this._count_short_clock[key][short_clock] = 0; // if array doesnt allready exist, create it
            this._count_short_clock[key][short_clock] += 1;
            
            // Map CLOCK=>[TIMESTAMP,..] and SHORT_CLOCK=>[TIMESTAMP,..]
            if(!this._map_clock[key][clock]) this._map_clock[key][clock] = []; // if array doesnt allready exist, create it
            if(this._map_clock[key][clock].indexOf(timestamp) == -1) this._map_clock[key][clock].push(timestamp);
            if(!this._map_clock[key][short_clock]) this._map_clock[key][short_clock] = []; // if array doesnt allready exist, create it
            if(this._map_clock[key][short_clock].indexOf(timestamp) == -1) this._map_clock[key][short_clock].push(timestamp);
            
            // Map CLOCK=>[ID,..] and SHORT_CLOCK=>[ID,..]
            if(!this._map_clockids[key][clock]) this._map_clockids[key][clock] = []; // if array doesnt allready exist, create it
            if(this._map_clockids[key][clock].indexOf(id) == -1) this._map_clockids[key][clock].push(id);
            if(!this._map_clockids[key][short_clock]) this._map_clockids[key][short_clock] = []; // if array doesnt allready exist, create it
            if(this._map_clockids[key][short_clock].indexOf(id) == -1) this._map_clockids[key][short_clock].push(id);
            
            // Flag as a owned clock if true
            if(user_owned){ 
                if(this._index_user_ids[key].indexOf(id) == -1 ) this._index_user_ids[key].push(id);
                if(this._index_user_timestamps[key].indexOf(timestamp) == -1 ) this._index_user_timestamps[key].push(timestamp);
                if(this._index_user_clocks[key].indexOf(clock) == -1 ) this._index_user_clocks[key].push(clock);
            }
            
            return {'id':id, 'timestamp':timestamp, 'date':date, 'clock':clock, 'indice':indice, 'short_clock':short_clock};
        },
 
        /*
        * Remove a timestamp entry from a key store
        * 
        * NOTE: Shouldn't be an "id" as argument instead of a "timestamp" and "indice" ??
        */
        'remove' : function(key, timestamp, indice) {
            // TODO: full clean of given timestamp in indexes and map
            //       Needed to clear history to avoid too much memory usage when user stay a long time
            //       This is not finished, but not used also for now, we need before to 
            //       see what index/count/map is really useful
            var id = timestamp+this.lpadding(indice),
                clock = this.timestamp_to_full_clock(timestamp, indice),
                short_clock = this.timestamp_to_short_clock(timestamp),
                date = this.timestamp_to_date(timestamp);
            
            delete this._index_ids[key][id];
            delete this._index_clocks[key][clock]; //full clock
            
            this._map_clock[key][clock].remove( this._map_clock[key].indexOf(clock) );
            this._map_clockids[key][clock].remove( this._map_clockids[key].indexOf(clock) );
            
            delete this._index_user_ids[key][id];
            delete this._index_user_clocks[key][clock]; //full clock
            
            this._count_timestamp[key][timestamp] -= 1;
            this._count_short_clock[key][timestamp] -= 1;
            
            return {'id':id, 'timestamp':timestamp, 'date':date, 'clock':clock, 'indice':indice, 'short_clock':short_clock};
        },
 
        // Calculate in "real time" the indice for the given timestamp using indexes
        get_timestamp_indice : function(key, ts) {
            if(!this._count_timestamp[key][ts]) {
                return 1;
            }
            // Identical timestamp count incremented by one
            return this._count_timestamp[key][ts]+1;
        },
        // Check if a clock is owned by the current user
        // Attempt a "simple" clock in argument, not a "full" clock
        is_user_clock : function(key, clock) {
            clock = this.clock_to_full_clock(clock);
            return (this._index_user_clocks[key].indexOf(clock) > -1 );
        },
 
 
        /* ********** PUBLIC STATICS ********** */
        /*
         * timestamp: 20130124005502
         * id: 2013012400550201 (the two last digits are the indice)
         * clock: 00:55:02 or 00:55 or 00:55:02²
         * clockclass: 005502
         * full clock: 00:55:02:01 (':01' is the indice padded on 2 digits)
         * short clock: 00:55 (seconds are stripped)
         */
        id_to_full_clock : function(id) {
            return this.timestamp_to_clock(id)+":"+id.substr(14,2);
        },
 
        timestamp_to_full_clock : function(ts, i) {
            return this.timestamp_to_clock(ts)+":"+this.lpadding(i);
        },
        timestamp_to_clock : function(ts) {
            return ts.substr(8,2)+":"+ts.substr(10,2)+":"+ts.substr(12,2);
        },
        timestamp_to_short_clock : function(ts) {
            return ts.substr(8,2)+":"+ts.substr(10,2);
        },
        // Renvoi un nom de classe composé d'une horloge sans les : à partir d'un timestamp
        timestamp_to_clockclass : function(ts) {
            return ts.substr(8,6);
        },
        // Renvoi la partie du timestamp concernant la date, sans l'horloge et le reste
        timestamp_to_date : function(ts) {
            return this.split_timestamp(ts)[0];
        },
        // Sépare en deux parties : date et time
        split_timestamp : function(ts) {
            return [ts.substr(0,8), ts.substr(8)];
        },
 
        // Convert a clock HH:MM[:SS[i]] to a full clock
        clock_to_full_clock : function(clock) {
            if(clock.length > 8) {
                return clock.substr(0,8)+":"+this.indice_to_number(clock.substr(8,2));
            } else if(clock.length < 8) {
                // short clock is assumed to be at second 00
                return clock+":00:01";
            }
            return clock+":01";
        },
 
        // Format to a padded number on two digits
        lpadding : function(indice) {
            if(indice > 0 && indice < 10) {
                return '0'+indice;
            }
            return "01";
        },
 
        // Return an exposant indice from the given number (padded on two digit)
        number_to_indice : function(i) {
            if( i > 1 )
                return this._indices[i-1];
            return '';
        },
        // Return a padded number on two digit from the given exposant indice
        indice_to_number : function(indice) {
            var i = this._indices.indexOf(indice);
            // Cherche un indice sous forme d'exposant
            if( i > -1 )
                return this.lpadding(i+1);
            return '01';
        },
        // Parse a plain clock "HH:MM[:SS[i]]" and return a "flat" version (without the ":") 
        // suitable for class/id css name
        // If not present in clock, default indice is "01"
        plainclock_to_cssname : function(clock) {
            var indice = "01";
            if(clock.length > 8){
                indice = this.indice_to_number(clock.substr(8,2));
                clock = clock.substr(0,8);
            }
            return clock.split(":").join("")+indice;
        },
        // Convert a full clock "HH:MM[:SS:[ii]]" to a "flat" version (without the ":") 
        // suitable for class/id css name
        clock_to_cssname : function(clock) {
            return clock.split(":").join("");
        }
    };
    
    
    
    /*
     * Various utilities
     */
    var CoreTools = {
        /*
         * Build and return a full url from the given args
         */
        get_request_url : function(host, path_view, options) {
            var url = host + path_view;
            if(options && $.param(options)!=''){
                url += "?" + $.param(options);
            }
            return url;
        },
        /*
         * Compute some extra datas from the row data from a backend
         */
        compute_extra_row_datas: function(row){
            row.css_classes = ["msgclock_"+row.clockclass];
            if(row.owned) row.css_classes.push("owned");
            row.identity = {'title': row.user_agent, 'kind': 'anonymous', 'content': row.user_agent.slice(0,30)};
            if(row.author__username){
                row.identity.kind = 'authenticated';
                row.identity.content = row.author__username;
            }
            return row;
        }
    };
    
    
    
    /*
     * Plugin HTML templates
     * This is not "real" templates like with "Mustach.js" and others but just 
     * some functions to build the needed HTML
     */
    var templates = {
        /*
         * Message row template
         * @content is an object with all needed attributes for the template
         */
        refresh_checkbox: function(settings) {
            var input_checked = (settings.refresh_active) ? " checked=\"checked\"" : "";
 
            return $('<p class="refresh_active"><input type="checkbox" name="active" value="1"'+ input_checked +'/></p>');
        },
 
        /*
         * Message row template
         * @content is an object with all needed attributes for the template
         */
        message_row: function(content, noclasses) {
            var clock_indice = "&nbsp;",
                noclass = (noclasses) ? true : false,
                css_classes = content.css_classes||[],
                row_classes;
            // Display clock indice only if greater than 1
            if(content.clock_indice > 1) clock_indice = clock_store.number_to_indice(content.clock_indice);
            // Detect /me action only for authenticated message
            if(content.identity.kind == 'authenticated' && content.web_render.search(/^\/me /) >= 0){
                css_classes.push('me-action');
                content.web_render = content.web_render.replace(/^\/me /, '');
            }
            row_classes = (noclasses) ? "" : " class=\"message "+ css_classes.join(" ") +"\""
            return "<li"+ row_classes +"><span class=\"marker\"></span>" +
                "<span class=\"clock\">"+ content.clock+"<sup>"+clock_indice +"</sup></span> " + 
                "<strong><span class=\"identity "+ content.identity.kind +"\" title=\""+ content.identity.title +"\">"+ content.identity.content +"</span></strong> " + 
                "<span class=\"content\">"+ content.web_render +"</span>" + 
            "</li>";
        }
    };
    
})( jQuery );