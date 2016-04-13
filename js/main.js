/*!
* Copyright 2016, Jesse Hall III
* This software may be freely distributed and modified under the MIT license.
*
* This software incorporates code and design features from Able Player:
* Copyright 2014, University of Washington
* http://ableplayer.github.io/ableplayer/
* Licensed under the MIT license
* Full license: https://github.com/ableplayer/ableplayer/blob/master/LICENSE
*/

(function($, key, window, document){

var model = {
    defaultAudioList : ["quijote_chap_1_spanish.ogg",
                        "quijote_chap_1_spanish.mp3"],
    defaultJsonFiles : ["quijote_chap_1_spanish.min.json",
                        "quijote_chap_1_english.min.json"],
    columns: [],
    indexColumn : null,
    screenIsLocked: false,
    originalLanguage : "",
    clientLanguage : "en",
    numberOfGroups : 0,
    lastGroupVisited: 0,
    lastTranslatedGroupVisited: 0,
    isAutoPauseActivated: true,
    originalColumnIndex: 0,
    translatedColumnIndex: 1,
    DOMcolumns: [],
    // time (in seconds) to fast forward or rewind
    unitOfTime: 1,
};

var controller = {
    init: function() {
        // store audio element
        controller.audioElem = document.getElementById('audioElem');

        // enable hotkeys
        controller.registerDefaultKeys();

        view.init();
    },
    registerDefaultKeys: function(){
        key('alt+ctrl+space', function(){
            // from Able Player
            if (!($('button').is(':focus'))) {
              // only toggle play if a button does not have focus
              // if a button has focus, space should activate that button
              controlsView.playPause();
            }
            return false;
        });
        key('alt+ctrl+p', function(){
            controlsView.playPause();
            return false;
        });
        key('alt+ctrl+s', function(){
            controlsView.stop();
            return false;
        });
        key('alt+ctrl+k', function(){
            controlsView.forwardGroup();
            return false;
        });
        key('alt+ctrl+j', function(){
            controlsView.backwardGroup();
            return false;
        });
        key('alt+ctrl+l', function(){
            controlsView.replay();
            return false;
        });
        key('alt+ctrl+f', function(){
            controlsView.forwardTime();
            return false;
        });
        key('alt+ctrl+r', function(){
            controlsView.backwardTime();
            return false;
        });
        key('alt+ctrl+m', function(){
            controlsView.mute();
            return false;
        });
        key('alt+ctrl+u', function(){
            controlsView.volumeUp();
            return false;
        });
        key('alt+ctrl+d', function(){
            controlsView.volumeDown();
            return false;
        });
        key('alt+ctrl+x', function(){
            controlsView.faster();
            return false;
        });
        key('alt+ctrl+z', function(){
            controlsView.slower();
            return false;
        });
        key('alt+ctrl+1', function(){
            // place focus on the highlighted segment
            // in the original language column
            controller.focusHighlightedSegment(model.originalColumnIndex);
            return false;
        });
        key('alt+ctrl+2', function(){
            // using 1 for index of the translated column
            // a temporary solution while working on
            // support for 3 columns
            controller.focusHighlightedSegment(model.translatedColumnIndex);
            return false;
        });
        // We only annoucne translated becuase
        // announcements only get announced in host language
        // of the screen reader.
        // For now we assume translation is in the host language.
        key('alt+ctrl+q', function(){
            controller.announceTranslated();
            return false;
        });
        key('alt+ctrl+o', function(){
            controller.announceHighlightTranslation();
            return false;
        });
        key('alt+ctrl+t', function(){
            // jump focus from current segment
            // to it's translated segment in the opposite column
            view.sendFocusToTranslated();
            return false;
        });
        key('enter', function(){
            // from Able Player
            var thisElement = $(document.activeElement);
            // we are only handling 'enter' keypresses from wihtin
            // the bounds of the player container
            var insidePlayerContainer = Boolean(thisElement.parents('#player_container').length > 0);
            if (insidePlayerContainer && (thisElement.prop('tagName') === 'SPAN' || 'BUTTON'))
            {
              thisElement.click();
              return false;
            }
        });
    },

    //***********************************
    // Loading Audio and Making Columns
    loadDefaults : function() {
        var audioList = model.defaultAudioList;
        controller.loadAudio(audioList);

        var jsonFiles = model.defaultJsonFiles;
        controller.makeAllColumns(jsonFiles);
    },
    // loadAudio modified from:  http://mos.creativebloq.com/tutorials/2013/html5-237.zip
    // Article URL: http://www.creativebloq.com/html5/build-custom-html5-video-player-9134473
    // Author: Ian Devlin (c) 2012
    // http://iandevlin.com
    // http://twitter.com/iandevlin
    loadAudio: function(audio_url_list){
      for (var i = 0; i < audio_url_list.length; i++) {
          var fileName = audio_url_list[i].split('.');
          var ext = fileName[fileName.length - 1];
          var playableType = controller.audioElem.canPlayType('audio/' + ext);
          // if the audio type is not playable, playableType will be ''
          if (playableType) {
              controller.audioElem.src = 'audio/' + audio_url_list[i];
              controller.audioElem.load();
              // once metadata is loaded
              // start showing info like time, duration, speed
              // in the data spans
              controller.audioElem.onloadedmetadata = function() {
                  view.updateDataSpans();
              }
              // announces "Ended" at end of audio
			  controller.audioElem.addEventListener('ended',view.endOfAudio,false);
              break;
          }
      }
    },
    makeAllColumns : function(jsonFiles){
        // make a spot for each column in the DOM
        jsonFiles.forEach(controller.makeSpotInDOM);
        // fill each spot in the DOM
        var promiseArray = controller.fillColumns(jsonFiles);
        Promise.all(promiseArray)
            // remove loading banners
            .then(view.liftLoadingCurtains)
            .catch(
                function(){
                    // console.log("Not All column promises resolved");
                    view.renderLoadingErrorMessage();
                }
            );
    },
    makeSpotInDOM : function(jsonFile, i, array){
        var numberOfColumns = array.length;
        var $interTextDiv = $('#interactiveText');
        // clear $interTextDiv once per array of jsonFiles
        if(i==0){$interTextDiv.children().not('.loading')};

        var $col = $('<div>');
        $col.attr('class','scrollContainer column');
        if(numberOfColumns>1){
            if(i == 0){
                $col.addClass('firstCol');
            }
            else if(i == numberOfColumns - 1){
                $col.addClass('lastCol');
            }
            else{
                $col.addClass('middleCol');
            }
        }
        $col.attr('id','column-' + i);

        // As of now, only 2-4 columns are allowed
        var columnClassDict = {1:'oneColumn', 2:'twoColumns', 3:'threeColumns', 4:'fourColumns'};
        // TODO: validate number of columns and handle errors accordingly
        var columnClass = columnClassDict[numberOfColumns] || columnClassDict[4];
        $col.addClass(columnClass);
        $col.html('<h4>Column Failed To Load</h4>');
        $interTextDiv.append($col);
        // store $col in model
        model.DOMcolumns[i] = $col;
    },
    fillColumns: function(jsonFiles){
        return jsonFiles.map(
            function(jsonFile, index){
                return Promise.resolve(
                            controller.loadJSON(jsonFile, index)
                        )
                        .then(
                            function(callData){
                                var jsonData = callData.jsonData;
                                var index = callData.index;
                                controller.processJSON(jsonData, index);
                                // fills column with words and highlighting
                                view.renderColumn(model.columns[index]);
                            }
                        )
            }
        );
    },
    loadJSON: function(jsonFile, index){
        return $.ajax(
            {
              dataType: "json",
              url: "json/" + jsonFile,
              mimeType: "application/json",
            }
        ).then(
            function(jsonData){
                return {'jsonData': jsonData, 'index': index }
            },
            function(error){
                // console.log("File failed to load: ", jsonFile);
            }
        );
    },
    processJSON: function(jsonData, index){
        var newColumn = {
            // if no title specified, use the name of the file
            title : jsonData["metadata"]["title"] || jsonFile,
            language : jsonData["metadata"]["language"],
            groups : jsonData["textAndTimeStamps"],
            // Need to include file name in future JSON formats
            // fileName : jsonFile,
            $elem : model.DOMcolumns[index],
            index: index,
            isOriginal : jsonData["metadata"]["isOriginalLanguage"]=="true" ? true : false,
            numberOfGroups : jsonData["textAndTimeStamps"].length,
        };
        // add the columns to our array
        model.columns[index] = newColumn;
        //
        // remember which lanuage is the original, non-translated
        if(jsonData["metadata"]["isOriginalLanguage"]=="true"){
            model.originalLanguage = jsonData["metadata"]["language"];
            // remember number of text groups in json
            // need to know when jumping back and forth between groups
            model.numberOfGroups = jsonData["textAndTimeStamps"].length;
            model.originalColumnIndex = index;
            model.indexColumn = model.columns[index];
        }
        // temporary fix for remembering the primary lanuage of the client
        // // for now we'll assume it's the same as the translated text
        else if(jsonData['metadata']['language']){
            model.clientLanguage = jsonData['metadata']['language'];
            model.translatedColumnIndex = [index];
        }
        // add state to each group
        // temporary fix before changing the format of the input json
        var column = model.columns[index];
        for(var i=0; i<column.groups.length; i++){
            var group = column.groups[i];
            // all groups start with an "off" state
            group['state'] = 0;
        }
    },
    // End Of Loading Audio and Making Columns
    //*****************************************

    //*****************************************
    // Actions Triggered By User
    wordClick: function (e){
        startTime = controller.getStartTime(e.target);
        // if we don't get a good value for startTime, escape the function
        if(isNaN(startTime) || (startTime <0)){ return; }
        controller.audioElem.currentTime = startTime;

        // on pause, we go into "Automatic Pause" mode
        model.isAutoPauseActivated = true;
        controller.playAudio();

        var groupIndex = controller.getGroupIndex(e.target);
        controller.updateLastGroup(groupIndex);
    },
    autoScroll: function($element){
        wordSpan = $element[0];
        var wordSpanPosition = ( wordSpan.getBoundingClientRect().top || wordSpan.getBoundingClientRect().y);
        // there are two scroll-containers
        $scrollContainer = $element.parents(".scrollContainer").first()
        //make sure a scroll container exists
        if($scrollContainer.length<=0){
            return;
        }
        // getBoundingClientRect().y doesn't work in chrome
        var scrollContainerPosition = ( $scrollContainer[0].getBoundingClientRect().top || $scrollContainer[0].getBoundingClientRect().y);
        // distance we want the wordSpan to be from the scrollContainer
        var margin = 60;
        var shiftDistance = wordSpanPosition - (scrollContainerPosition + margin);

        $scrollContainer.stop().animate(
            {
                scrollTop: $scrollContainer[0].scrollTop + shiftDistance,
            },500
        );
    },
    focusHighlightedSegment : function(index){
        var column = model.columns[index];
        var groupIndex = model.lastGroupVisited;
        var spanID = controller.getSpanID(column, groupIndex);

        $focusElem = $("#" + spanID);
        $focusElem.focus();
    },
    announceHighlightTranslation : function(){
        var column = model.columns[model.translatedColumnIndex];
        var groupIndex = model.lastGroupVisited;
        var spanID = controller.getSpanID(column, groupIndex);

        $translationSpan = $('#' + spanID);
        var message = $translationSpan.text();
        $.announce(message);
    },
    announceTranslated : function(){
        var message = view.getTextOfTranslated();
        if(message){
            $.announce(message);
        }
    },
    changePlaybackRate: function(isDirectionPositive){
        var rate = controller.audioElem.playbackRate;
        if(isDirectionPositive){
            rate = rate + 0.1 >= 4 ? 4.0 : rate + 0.1;
        }
        else{
            rate = rate - 0.1 <= 0.5 ? 0.5 : rate - 0.1;
        }
        controller.audioElem.playbackRate = rate;
        view.updateRateSpanAndAnnounce();
    },
    changeVolume: function(isDirectionPositive) {
        var volume = controller.audioElem.volume;
        if(isDirectionPositive){
            volume = volume + 0.1 >= 1 ? 1 : volume + 0.1;
        }
        else {
            volume = volume - 0.1 <= 0 ? 0 : volume - 0.1;
        }
        controller.audioElem.volume = volume;
        // announce new volume
        // only if audio is paused
        // (it's annoying if the audio is playing)
        if (controller.audioElem.paused){
            $.announce('Volume: ' + volume.toFixed(1));
        }
    },
    changeTime: function(isDirectionPositive){
        var unitOfTime = model.unitOfTime;
        if (isDirectionPositive) {
            controller.audioElem.currentTime+= unitOfTime;
        }
        else {
            controller.audioElem.currentTime-= unitOfTime;
        }
        // announce new time only if audio is paused
        // (it's annoying if the audio is playing)
        if (controller.audioElem.paused){
            view.announceAriaTimeSpan();
        }
    },
    toggleMute: function(){
        var isMuted = controller.audioElem.muted;
        if(isMuted){
            // if already muted, set property to false
            controller.audioElem.muted = false;
            // announce current volume level
            var volume = controller.audioElem.volume;
            // announce new volume
            // only if audio is paused
            // (it's annoying if the audio is playing)
            if (controller.audioElem.paused){
                $.announce('Volume: ' + volume.toFixed(1));
            }
        }
        else{
            // if not muted, set property to true
            controller.audioElem.muted = true;
            // announce muted status
            $.announce('Muted');
        }
    },
    togglePlay: function(){
        is_paused = controller.audioElem.paused;
        if(is_paused){
            // on play, we go into "Continuous Play" mode
            model.isAutoPauseActivated = false;
            controller.playAudio();
        }
        else {
            // on pause, we go into "Automatic Pause" mode
            model.isAutoPauseActivated = true;
            controller.pauseAudio();
        }
    },
    playAudio: function(){
        controller.audioElem.play();
        // change labels, change status text to "Playing"
        view.renderPlayIndicators();
    },
    pauseAudio: function(){
        controller.audioElem.pause();
        // change labels, change status text to "Paused"
        // announce "Pause" if not in Automatic Pause Mode
        view.renderPauseIndicators();
    },
    replaySegment: function(){
        // reset time of the audio to the start of the group
        controller.resetToStartOfGroup();
        // on replay, we go into "Automatic Pause" mode
        model.isAutoPauseActivated = true;
        controller.playAudio();
    },
    stop: function(){
        controller.audioElem.pause();
        controller.audioElem.currentTime=0;
        controller.updateLastGroup(0);
        view.renderStopIndicators();
        // on stop, we go into "Automatic Pause" mode
        model.isAutoPauseActivated = true;
    },
    // End Of Actions Triggered By User
    //*****************************************

    //*****************************************
    // Moving Between Groups
    changeGroup: function(isDirectionPositive){
        var lastGroup = model.lastGroupVisited;
        var totalGroups = model.numberOfGroups || 0;
        if(isDirectionPositive){
            // nextgroup is an index
            // nextGroup increments till limit, then goes back to zero
            var nextGroup = lastGroup+1 < totalGroups ? lastGroup+1 : 0;
            newStartTime = model.indexColumn.groups[nextGroup].start_time || 0;
        }
        else {
            // nextGroup decrements till 0, then goes back to top
            var nextGroup = lastGroup-1 >= 0 ? lastGroup-1 : totalGroups-1;
            newStartTime = model.indexColumn.groups[nextGroup].start_time || 0;
        }
        // adding a little buffer to ensure we are comfortably within the bounds of the next segment
        var buffer = 0.01;
        // advance audio to new start time
        controller.audioElem.currentTime = newStartTime + buffer;
        // update lastGroupVisited
        controller.updateLastGroup(nextGroup);
        controller.playAudio();
    },
    resetToStartOfGroup : function(){
        var currentGroupIndex = model.lastGroupVisited;
        var column = model.indexColumn;
        var currentGroupStartTime = column.groups[currentGroupIndex].start_time
        // adding a little buffer to ensure we are comfortably within the bounds of the next segment
        var buffer = 0.01;
        controller.audioElem.currentTime = currentGroupStartTime + buffer;
    },
    updateLastGroup: function(groupIndex){
        model.lastGroupVisited = groupIndex;
        view.addHighlighting(groupIndex);
    },
    // End Of Moving Between Groups
    //*****************************************

    //*****************************************
    // Checking States
    // This means checking for which segments
    // should be highlighted at any given time.
    playPauseCheckStates: function(time, target){
            // whenever we get past the target
            if(time>=target){
                controller.pauseAudio();
                controller.resetToStartOfGroup();
            }
    },
    checkStates : function(time){
        var column = model.indexColumn;
        column.groups.forEach(function(group, groupIndex){
            var previousState = group.state;
            if (time>=(group.start_time) && time<=(group.end_time)){
                // if previousState is 0, or "off"
                if(!previousState){
                    // console.log("trigger START!,  groupIndex: " + groupIndex);
                    controller.updateLastGroup(groupIndex);
                }
                // state is now "on" (or was already on)
                group.state = 1;
            }
            else{
                // if previousState is 1, or "on"
                if(previousState){
                    // console.log("trigger END!,  groupIndex: " + groupIndex);
                    view.removeHighlighting(groupIndex);
                }
                // state is now "off" (or was already off)
                group.state = 0;
            }
        });
    },
    // End Of Checking States
    //*****************************************

    //*****************************************
    // Misc Utility Functions
    getGroupIndex : function(elem){
        // elem id looks like "col-0-g-5"
        // columns start at 0, groups start at 1
        var groupIndex = parseInt(elem.id.split('-')[3]) - 1 || 0;
        return groupIndex;
    },
    getStartTime : function(elem){
        var startTime = parseFloat(elem.dataset.start_time);
        return startTime;
    },
    getSpanID : function(column, index){
        var spanID = "col-" + column.index + "-" + column.groups[index].group_id;
        return spanID;
    },
    getSpanArray$ : function(groupIndex){
        var spanArray$ = [];
        model.columns.forEach(function(column){
            var spanID = "col-" + column.index + "-" + column.groups[groupIndex].group_id;
            var $spanElement = $('#'+spanID);
            spanArray$.push($spanElement);
        });
        return spanArray$;
    },
    // End Of Misc Utility Functions
    //*****************************************
};


var view = {
    init: function() {
        view.$rateSpan = $("#rateSpan");
        view.$durationSpan = $("#durationSpan");

        // Load the Default Audio and JSON Files
        controller.loadDefaults();

        controlsView.init();
    },
    // Builds up a column and injects it into DOM
    renderColumn: function(column){
        column.$elem.html("");
        column.$elem.attr('lang', column.language);
        view.addAccessibleHeader(column);
        var finalSpan = null;
        //create first paragraph to fill
        var p_container = document.createElement('p');
        column.$elem.append(p_container);

        column.groups.forEach(function(group, index){
            // if group is a new paragraph
            // start a new 'p' element to fill
            // index > 0 becuase the first group
            // get a paragraph automatically
            if (group.special == 'p' && index > 0){
                p_container = document.createElement('p');
                column.$elem[0].appendChild(p_container);
            }

            var startTime = group.start_time;
            var endTime = group.end_time;

            // put together full text segment
            var fillerText = '';
            group.word_data.forEach(function(oneWordData){
              fillerText = fillerText + oneWordData.word_text + " ";
            });

            // create wordSpan
            var wordSpan = document.createElement('span');
            wordSpan.innerHTML = fillerText;
            wordSpan.id = controller.getSpanID(column, index);
            wordSpan.dataset.start_time = startTime;
            wordSpan.setAttribute('tabIndex', 0);
            wordSpan.addEventListener('click', controller.wordClick, false);
            // need this for test condition at the bottom
            if(index == column.groups.length-1){
                finalSpan = wordSpan;
            }

            p_container.appendChild(wordSpan);
        });
        // highlight first group
        if (column.groups[0]){
            controller.updateLastGroup(0);
        }
    },

    //*******************************
    // Visual and Audio Feedback Functions
    addHighlighting: function(groupIndex){
        var $anySelectedSpan = $('.selected');
        $anySelectedSpan.removeClass('selected')

        var spanArray$ = controller.getSpanArray$(groupIndex);
        spanArray$.forEach(function($span, index){
            // add highlighting to span
            $span.addClass('selected');
            // auto-scroll to the highlighted span
            controller.autoScroll($span);
        });
    },
    removeHighlighting: function(groupIndex){
        var spanArray$ = controller.getSpanArray$(groupIndex);
        spanArray$.forEach(function($span){
            $span.removeClass('selected');
        });
    },
    updateDataSpans: function(){
        setInterval(function(){
            var duration = controller.audioElem.duration
            var durationHrsSecsMins = view.getHoursSecsMins(duration);
            var durationString = view.getFormattedTime(durationHrsSecsMins);
            $('#durationSpan').text(durationString);

            var currentTime = controller.audioElem.currentTime;
            var hrsSecsMins = view.getHoursSecsMins(currentTime);
            var displayTimeString = view.getFormattedTime(hrsSecsMins);
            $('#currentTimeSpan').text(displayTimeString);
            if (model.isAutoPauseActivated) {
                var currentGroupIndex = model.lastGroupVisited;
                var i = model.originalColumnIndex;
                var target = model.columns[i].groups[currentGroupIndex].end_time
                controller.playPauseCheckStates(currentTime, target);
            }
            else {
                controller.checkStates(currentTime);
            }
        }, 50);
    },
    announceAriaTimeSpan: function(){
        var currentTime = controller.audioElem.currentTime;
        var hrsSecsMins = view.getHoursSecsMins(currentTime);
        var ariaTimeString = view.getAriaFormattedTime(hrsSecsMins);
        $.announce(ariaTimeString);
    },
    updateRateSpanAndAnnounce : function(){
        var rate = controller.audioElem.playbackRate;
        $('#rateSpan').text('Speed: ' + rate.toFixed(2));
        // announce new speed
        // only if audio is paused
        // (it's annoying if the audio is playing)
        if (controller.audioElem.paused){
            $.announce('Speed: ' + rate.toFixed(2));
        }
    },
    liftLoadingCurtains: function(){
        $('.loading').fadeOut(3000);
        $('#timeRow').removeClass('curtain');
    },
    renderLoadingErrorMessage: function(){
        $('#loadingMessage').fadeOut(1500,
            function(){
                $(this).text('Loading Error')
            }
        ).delay(200).fadeIn(1000);
        var alertMessage = "Alert: Error loading data. Please check your network connection.";
        $.announce(alertMessage);
    },
    addAccessibleHeader : function(column){
        // add accessible header so folks know what
        // column they are getting into
        var accessibleHeader = document.createElement('h3');
        var headerLanguage = column.isOriginal ? "Original Language" : "Translation";
        var headerText = "Entering Interactive Text For The " + headerLanguage;
        accessibleHeader.innerHTML = headerText;
        accessibleHeader.className = "offscreen";
        // language of this header might be different
        // from it's container, so we deliberately set it
        accessibleHeader.lang = model.clientLanguage;
        accessibleHeader.setAttribute('tabIndex', 0);
        column.$elem.append(accessibleHeader);
    },
    endOfAudio: function(){
        //change labels
		controlsView.$playPause.removeClass('icon-pause2');
		controlsView.$playPause.addClass('icon-play3');
        var ended = 'Ended';
        // change status in view
		$('#status').text(ended);
        // make announcement
        $.announce(ended);
	},
    renderPlayIndicators: function(){
        controlsView.$playPause.attr("aria-label","Pause");
        controlsView.$playPause.removeClass('icon-play3');
        controlsView.$playPause.addClass('icon-pause2');
        // change status in view
        $('#status').text("Playing");
        // no $.announce() on "Playing" because the alert conflicts with the audio
    },
    renderPauseIndicators: function(){
        controlsView.$playPause.attr("aria-label","Play");
        controlsView.$playPause.removeClass('icon-pause2');
        controlsView.$playPause.addClass('icon-play3');
        var paused = 'Paused';
        // change status in view
        $('#status').text(paused);
        // Make announcement
        // only if NOT in automatic pasue mode.
        // This is becuase it's annoying to hear
        // after every little segment.
        if( !model.isAutoPauseActivated ) {
            $.announce(paused);
        }
    },
    renderStopIndicators: function(){
        // change labels
        controlsView.$playPause.removeClass('icon-pause2');
        controlsView.$playPause.addClass('icon-play3');
        controlsView.$playPause.attr("aria-label","Play");

        var stopped = 'Stopped';
        // change status in view
        $('#status').text(stopped);
        // make announcement
        $.announce(stopped);
    },
    //End Of Visual and Audio Feedback Functions
    // *******************************

    //*******************************
    // Time Formatting Functions
    getHoursSecsMins: function(totalTime) {
        // no support for time less than 0
        // or greater than 99:59:59
        if(totalTime < 0 || totalTime > 359999 ){
            totalTime = 0;
        }
        var rMS = totalTime % (60*60) // remaining minutes and seconds
        var rS = rMS % 60 // remaining seconds
        var hours = (totalTime - rMS)/(60*60);
        var mins = (rMS - rS)/60;
        var secs = rS;
        // we're rounding to the nearst second
        secs = Math.round(rS);

        return {"hours": hours, "mins": mins, "secs": secs};
    },
    pad: function (num) {
        var numString = num.toString();
        if(numString<10){
        numString = "0" + numString;
        }
        return numString;
    },
    getFormattedTime: function(hrsSecsMins){
        // hours get no padding
        var hours = hrsSecsMins.hours;
        var mins = view.pad(hrsSecsMins.mins);
        var secs = view.pad(hrsSecsMins.secs);
        // only display hours if time goes that far
        var outputString = (hours>0) ? hours + ":" : "";
        outputString += mins + ":" + secs;
        return outputString;
    },
    getAriaFormattedTime: function(hrsSecsMins){
        // hours get no padding
        var hours = hrsSecsMins.hours;
        var mins = hrsSecsMins.mins;
        var secs = hrsSecsMins.secs;
        // only display hours if time goes that far
        var outputString = (hours>0) ? hours + " Hours, " : "";
        // only display minutes if time goes that far
        outputString += (mins>0) ? mins + " Minutes, " : "";
        outputString += secs + " Seconds";
        return outputString;
    },
    //End Of Time Formatting Functions
    // *******************************

    // *******************************
    // Misc Utility Functions
    getIndexOfFocus: function(){
        // set index of focus to column of the original language by defualt
        // get orignalcolumnindex
        var indexOfFocus = model.originalColumnIndex;

        var focusElem = document.activeElement;
        if(focusElem.id.indexOf('col-')>-1){
            indexOfFocus = focusElem.id.split('-')[1];
        }
        return indexOfFocus;
    },
    sendFocusToTranslated : function(){
        var focusElem = document.activeElement;
        if(focusElem.id.indexOf('col-')>-1){
            // get index of translated column index
            var columnIndex = parseInt(focusElem.id.split('-')[1]);
            var length = model.columns.length;
            // translated column index rotates through all columns
            var translatedColumnIndex = columnIndex + 1 < length ? columnIndex + 1 : 0;
            // get span ID
            var groupIndex = controller.getGroupIndex(focusElem);
            var translatedColumn = model.columns[translatedColumnIndex];
            var spanID = controller.getSpanID(column=translatedColumn,
                                    index = groupIndex);
            // focus the span
            $newFocusElem = $('#'+spanID);
            $newFocusElem.focus();
        }
    },
    getTextOfTranslated : function(){
        // this will currently only work with 2 columns
        // following is temporary code before re-doing
        // how columns are built and specficying the translation column
        // and re-doing the dependent code for that
        var OCindex = model.originalColumnIndex;
        var length = model.columns.length;
        // for now translatedColumnIndex will evaluate to either 0 or 1
        var translatedColumnIndex = OCindex + 1 < length ? OCindex+1 : 0;

        // get span ID
        var focusElem = document.activeElement;
        var groupIndex = controller.getGroupIndex(focusElem);
        var translatedColumn = model.columns[translatedColumnIndex];
        var spanID = controller.getSpanID(column=translatedColumn,
                                index = groupIndex);

        var textOfTranslated = '';
        var $translatedElem = $('#'+spanID);
        if($translatedElem[0].id.indexOf('col-')>-1){
            textOfTranslated = $translatedElem.text();
        }
        return textOfTranslated;
    },
    // End of Misc Utility Functions
    // *******************************
};

var controlsView ={
  init: function(){
      // one listener for all buttons in control panel
      var controlPanelDiv = document.getElementById('control_panel');
      controlPanelDiv.addEventListener('click', controlsView.controlPanelClick, false);

      // "play and pause" element is currenlty the only
      // element that changes in the view
      controlsView.$playPause = $('#playPause');

  },
  controlPanelClick : function(e){
      if(e.target.nodeName.toLowerCase() == "button"){
          var buttonID = e.target.id;
          controlsView[buttonID]();
      }
  },
  faster: function(){
      var isDirectionPositive = true;
      controller.changePlaybackRate(isDirectionPositive);
  },
  slower: function(){
      var isDirectionPositive = false;
      controller.changePlaybackRate(isDirectionPositive);
  },
  volumeUp: function(){
      var isDirectionPositive = true;
      controller.changeVolume(isDirectionPositive);
  },
  volumeDown: function(){
      var isDirectionPositive = false;
      controller.changeVolume(isDirectionPositive);
  },
  mute: function(){
      controller.toggleMute();
  },
  replay: function(){
      controller.replaySegment();
  },
  playPause: function(){
      controller.togglePlay();
  },
  forwardTime: function(){
      var isDirectionPositive = true;
      controller.changeTime(isDirectionPositive);
  },
  backwardTime: function(){
      var isDirectionPositive = false;
      controller.changeTime(isDirectionPositive);
  },
  forwardGroup: function(){
      var isDirectionPositive = true;
      controller.changeGroup(isDirectionPositive);
  },
  backwardGroup: function(){
      var isDirectionPositive = false;
      controller.changeGroup(isDirectionPositive);
  },
  stop: function(){
      controller.stop();
  },
};

$(document).ready(function($) {
  controller.init();
});

}(window.jQuery, window.key, window, document));
