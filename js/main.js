/* * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    WORLD BANK - Afghanistan Reconstruction Trust Fund

 * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

(function ($) {
    'use strict';

    var DATA_API_ENDPOINT    = 'data/data.json';

    var FILTER_INTERSECTION_MODE = false,
        FILTER_FIELDS        = ['status', 'project_name', 'sector'];

    var VIZ_MARGINS          = {top: 25, right: 30, bottom: 0, left: 0},
        VIZ_WIDTH            = document.querySelector('.container').offsetWidth,
        VIZ_VIEWPORT_WIDTH   = VIZ_WIDTH - VIZ_MARGINS.right - VIZ_MARGINS.left,
        VIZ_CHART_AREA_WIDTH = VIZ_VIEWPORT_WIDTH,
        VIZ_LABEL_AREA_WIDTH = 0,
        VIZ_ROW_SPACING      = 80,
        VIZ_MAIN_COLOR       = '#27a9e1',
        VIZ_ACCENT_COLOR     = '#c34040';

    // ARTF color scheme
    var ARTF_COLOR_GREEN     = '#66863a',  // ARTF.af headings text color
        ARTF_COLOR_LTGREEN   = '#9db679',  // ARTF.af sidebar color
        ARTF_COLOR_BLUE      = '#276cb0',  // ARTF.af main color
        ARTF_COLOR_LTBLUE    = '#87a4c1',  // ARTF.af sidebar color
        ARTF_COLOR_ORANGERED = '#c54b25';  // Color interpreted from ARTF.af header image

    var MODE_COLOR_SCHEME    = 1,
        MODE_TREND_BUBBLES   = 1

    // Borrowed from Colorbrewer
    // 0 is No data (gray)
    // 1-5 is the red-green scale from http://bl.ocks.org/mbostock/5577023
    var INDICATOR_COLOR_SCALE = ['#cdcdcd','#d7191c','#fdae61','#ffffbf','#a6d96a','#1a9641'];

    // Get data!
    var data =[];

    $.get(DATA_API_ENDPOINT, function (response) {

        data = _parseData(response);

        // Get dropdown options for the filters
        for (var i = 0; i < FILTER_FIELDS.length; i++) {
            var field   = FILTER_FIELDS[i];
            var entries = _getEntriesForFilter(data, FILTER_FIELDS[i]);

            // Populate dropdowns with options
            for (var j = 0; j < entries.length; j++) {
                if (_.isUndefined(entries[j]) === true) continue;
                $('select[data-field=' + field +']').append('<option value="' + entries[j] + '">' + entries[j] + '</option>');
            }
        }

        // Create SVG viz
        createViz(data);
    });

    $(document).ready(function () {

        // Filter behavior
        $('#filter select').on('change', function (e) {
            var selected = $(this).data('field')

            // Create our filter
            $('#filter select').each(function (index) {
                var field = $(this).data('field');

                // If combining filters is disabled, we'll reset the other filters first
                if (!FILTER_INTERSECTION_MODE && field !== selected) this.selectedIndex = 0;
            });

            // Redraw visualization
            createViz(data);
        });

        // Resets visualization
        $('#filter-reset').on('click', function (e) {
            createViz(data);
        });

        // Hide legend
        $('#hide-legend').on('click', function (e) {
            $('#legend').slideUp(200);
        });

        if (window.self === window.top) {
            $('#debug').show()
            $('#debug-close').on('click', function () {
                $('#debug').toggleClass('hide')
            })
            $('#debug-color').on('change', function () {
                createViz(data);
            })
            $('#debug-trend').on('change', function () {
                createViz(data);
            })
        }

    });

    // Massive SVG creation function
    function createViz (data) {
        // If there is a previous SVG, remove it
        d3.select('#viz').select('svg').remove();

        // Get current settings...
        var colors = _optionGetColors($('#debug-color').val());
        var trendMode = parseInt($('#debug-trend').val());

        // Get current filters...
        var filter   = {};
        // Create our filter
        $('#filter select').each(function (index) {
            var field = $(this).data('field');
            // Gather values for the filter
            var value = $(this).val();
            if (value) filter[field] = value;
        });
        // Apply the filter to our data
        data = _.where(data, filter);

        // color scale
        // TODO: Set colors based on category, not per line
        // c(i) where i = index -> returns a color
        var c = d3.scale.category10();

        // Set up SVG display area
        var svg = d3.select('#viz').append('svg')
            .attr('width', VIZ_WIDTH)
            .append('g')
            .classed('viz-area', true)
            .attr('transform', 'translate(' + VIZ_MARGINS.left + ',' + VIZ_MARGINS.top + ')');

        // If we don't have any data, display a notice
        if (data.length < 1) {
            svg.append('text')
                .attr('x', VIZ_VIEWPORT_WIDTH / 2)
                .attr('y', VIZ_ROW_SPACING)
                .attr('text-anchor', 'middle')
                .text('No indicators match your filter criteria.')
                .style('fill', 'gray');
            return false;
        }

        // Sort the data by display order
        data = _sortDataInDisplayOrder(data);

        var startDate = _getStartDate(data),
            endDate   = _getEndDate(data);

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

        //             * * *   AXIS FORMATTING   * * *             //

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

        // Set up the domain and range for the X-axis scale, based on the data we have
        var xScale = d3.time.scale()
            .domain([startDate, endDate])
            .nice(d3.time.year)
            .range([30, VIZ_CHART_AREA_WIDTH]);

        // Set up the X-axis itself
        // Tick formatting labels only the year, with empty strings for months
        var xAxis = d3.svg.axis()
            .scale(xScale)
            .ticks(d3.time.month, 6)
            .tickFormat(d3.time.format.multi([
                ['%Y', function (d) { return (d.getMonth() === 0) ? true : false }],
                ['', function (d) { return true }]
            ]))
            .orient('top');

        // Further axis formatting on the SVG element
        var xAxisG = svg.append('g')
            .attr('class', 'x axis')
            .attr('transform', 'translate(' + VIZ_LABEL_AREA_WIDTH + ',' + 0 + ')')
            .call(xAxis)
            .selectAll('text')
            .attr('y', -14)
            .style('text-anchor', 'middle');

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

        //             * * *   DATA FORMATTING   * * *             //

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

        // Data and formatting specific to each data set
        for (var j = 0; j < data.length; j++) {

            var indicator = data[j]

            // Vertical position of indicator
            var yPos = (j + 1) * VIZ_ROW_SPACING - 30;

            // Create group for each indicator
            var g = svg.append('g').attr('class', 'indicator');

            var gBg = g.append('g').append('rect')
                .classed('background', true)
                .attr('x', 0)
                .attr('y', yPos - (VIZ_ROW_SPACING / 2))
                .attr('width', VIZ_WIDTH)
                .attr('height', VIZ_ROW_SPACING);

            // Add horizontal line
            var gLine = g.append('line')
                .attr('class', 'indicator-line')
                .attr('x1', 30)
                .attr('x2', VIZ_VIEWPORT_WIDTH)
                .attr('y1', yPos)
                .attr('y2', yPos)
                .style('stroke', _getProgressColor(indicator.progress));

            // Baseline data group
            var gBaselineCircle = g.append('g').attr('class', 'indicator-baseline');

            var baselineCircle = gBaselineCircle.selectAll('circle')
                .data([indicator.baseline])
                .enter()
                .append('circle')
                .attr('class', 'circle-baseline')
                .style('fill', colors.baselineCircle)
                /*
                .call(d3.helper.tooltip()
                    .attr({ class: 'tooltip' })
                    .text(function (d, i) { return '<strong>' + d.displayString + '</strong><br><span class="date">' + moment(d.date).format('MMMM D, YYYY') + '</span>'; })
                )
                */
                .on('mouseover', function (d, i) { d3.select(this).classed('highlight', true); })
                .on('mouseout', function (d, i) { d3.select(this).classed('highlight', false); });
                //.on('mouseover.indicator', _onMouseoverIndicator)
                //.on('mouseout.indicator', _onMouseoutIndicator)
                //.on('click.indicator', _onClickIndicator);

            // Measured data group
            var gValues = g.append('g').attr('class', 'indicator-measured');

            var circles = gValues.selectAll('circle')
                .data(indicator.measurements)
                .enter()
                .append('circle')
                .attr('class', 'circle-measured')
                .style('fill', colors.measureCircle);
                /*
                .call(d3.helper.tooltip()
                    .attr({ class: 'tooltip' })
                    .text(function (d, i) { return '<strong>' + d.displayString + '</strong><br><span class="date">' + moment(d.date).format('MMMM D, YYYY') + '</span>'; })
                )*/
                //.on('mouseover.indicator', _onMouseoverIndicator)
                //.on('mouseout.indicator', _onMouseoutIndicator)
                //.on('click.indicator', _onClickIndicator);

            // Subtarget group
            var gSubtargets = g.append('g').attr('class', 'indicator-subtargets');

            var subtargetCircles = gSubtargets.selectAll('circle')
                .data(_makeSubtargets(indicator))
                .enter()
                .append('circle')
                .classed('circle-subtargets', true)
                .style('stroke', colors.subtargetCircle);
                //.on('mouseover.indicator', _onMouseoverIndicator)
                //.on('mouseout.indicator', _onMouseoutIndicator)
                //.on('click.indicator', _onClickIndicator);

            // Latest measured data group
            // AKA PROJECTED CIRCLE
            var gLatestCircle = g.append('g').attr('class', 'indicator-latest');

            var latestCircle = gLatestCircle.selectAll('circle')
            //  .data([indicator.projectedValue])
                .data([indicator.measurements[indicator.measurements.length - 1]])
                .enter()
                .append('circle')
                .attr('class', 'circle-latest')
                .style('fill', colors.latestCircle);
                /*
                .call(d3.helper.tooltip()
                    .attr({ class: 'tooltip' })
                    .text(function (d, i) { return '<strong>' + d.displayString + '</strong><br><span class="date">' + moment(d.date).format('MMMM D, YYYY') + '</span>'; })
                )*/
                //.on('mouseover.indicator', _onMouseoverIndicator)
                //.on('mouseout.indicator', _onMouseoutIndicator)
                //.on('click.indicator', _onClickIndicator);

            // Target group
            var gTarget = g.append('g').attr('class', 'indicator-targeted');

            var targetCircle = gTarget.selectAll('circle')
                .data([indicator.target])
                .enter()
                .append('circle')
                .classed('circle-targeted', true)
                .style('stroke', colors.targetCircle);
                /*
                .call(d3.helper.tooltip()
                    .attr({ class: 'tooltip' })
                    .text(function (d, i) { return '<strong>' + d.displayString + '</strong><br><span class="date">' + moment(d.date).format('MMMM D, YYYY') + '</span>'; })
                )
*/
               //.on('mouseover.indicator', _onMouseoverIndicator)
               // .on('mouseout.indicator', _onMouseoutIndicator)
               // .on('click.indicator', _onClickIndicator);

            // Text label groups
            var gBaselineLabel = g.append('g').attr('class', 'indicator-baseline-label');

            var baselineLabel = gBaselineLabel.selectAll('text')
                .data([indicator.baseline])
                .enter()
                .append('text');

            var gMeasurementLabel = g.append('g').attr('class', 'indicator-measurement-label');

            var measurementLabel = gMeasurementLabel.selectAll('text')
                .data(indicator.measurements)
                .enter()
                .append('text');

            var gTargetLabel = g.append('g').attr('class', 'indicator-target-label');

            var targetLabel = gTargetLabel.selectAll('text')
                .data([indicator.target])
                .enter()
                .append('text');

            // Special rect shape for interaction hover area
            var gHoverArea = g.append('rect')
                .classed('hoverable', true)
                .attr('x', 0)
                .attr('y', yPos - (VIZ_ROW_SPACING / 2))
                .attr('width', VIZ_VIEWPORT_WIDTH)
                .attr('height', VIZ_ROW_SPACING)
                .on('mouseover.indicator', _onMouseoverIndicator)
                .on('mouseout.indicator', _onMouseoutIndicator)
                .on('click.indicator', _onClickIndicator);


            // Hoverable data group
            /*
            var gData = g.append('g').attr('class', 'indicator-data');

            var dataRect = gData.selectAll('rect')
                .data(['hey'])
                .enter()
                .append('rect')
                .classed
                */

            // Set radius of circle sizes
            // For the upper range, calculate based on width of viewport and number of
            // ticks so as to never overlap circles, but never more than 14
            var radiusLowerRange = 4;
            var radiusUpperRange = 14;
            // TODO


            // Radius scale for circle
            // If baseline measurement is lower than the target, it should increase on the X-axis
            // Flip the range if baseline is higher than the target measurement.
            if (indicator.targetIsIncreasing === true) {
                var rScale = d3.scale.linear()
                    .domain([indicator.baseline.value, indicator.target.value])
                    .range([radiusLowerRange, radiusUpperRange]);
            } else {
                var rScale = d3.scale.linear()
                    .domain([indicator.baseline.value, indicator.target.value])
                    .range([radiusUpperRange, radiusLowerRange]);
            }

            // Baseline circle
            baselineCircle
                .attr('cx', function (d) {
                    return VIZ_LABEL_AREA_WIDTH + xScale(d.dateRounded);
                })
                .attr('cy', yPos)
                .attr('r', function (d) { return rScale(d.value); });

            // Measured circles
            circles
                .attr('cx', function (d, i) {
                    return VIZ_LABEL_AREA_WIDTH + xScale(d.dateRounded);
                })
                .attr('cy', yPos)
                .attr('r', function (d) {
                    // If the target is decreasing, and a measurement overshoots it, the
                    // linear scale could result in a r-value less than 0. This would cause
                    // an error because a radius can't be less than 0. For sake of
                    // readability, we'll clamp the minimum radius to 2 pixels.
                    return (rScale(d.value) >= 2) ? rScale(d.value) : 2;
                });

            // Latest measurement circle
            latestCircle
                .attr('cx', function (d, i) {
                    if (trendMode !== 2 || (trendMode === 2 && indicator.target.dateRounded >= _roundDateToHalfYear(new Date()))) {
                        return VIZ_LABEL_AREA_WIDTH + xScale(indicator.target.dateRounded);
                    } else {
                        // If hidden, just move it way off the page
                        return -1000;
                    }
                })
                .attr('cy', yPos)
                .attr('r', function (d) {
                    // If the target is decreasing, and a measurement overshoots it, the
                    // linear scale could result in a r-value less than 0. This would cause
                    // an error because a radius can't be less than 0. For sake of
                    // readability, we'll clamp the minimum radius to 2 pixels.
                    return (rScale(d.value) >= 2) ? rScale(d.value) : 2;
                });

            // Target circle
            targetCircle
                .attr('cx', function (d) {
                    return VIZ_LABEL_AREA_WIDTH + xScale(d.dateRounded);
                })
                .attr('cy', yPos)
                .attr('r', function (d) { return rScale(d.value); });

            // Subtarget circles
            subtargetCircles
                .attr('cx', function (d) {
                    if (trendMode !== 2 || (trendMode === 2 && d.date > new Date())) {
                        return VIZ_LABEL_AREA_WIDTH + xScale(d.date);
                    } else {
                        // If hidden, just move it way off the page
                        return -1000;
                    }
                })
                .attr('cy', yPos)
                .attr('r', function (d) { return rScale(d.value); });

            // Baseline labels
            baselineLabel
                .attr('x', function (d) {
                    return VIZ_LABEL_AREA_WIDTH + xScale(d.dateRounded);
                })
                .attr('y', yPos - 10)
                .attr('text-anchor', 'middle')
                .attr('class', 'hidden label label-baseline')
                .style('fill', colors.baselineLabel)
                .text(function (d) { return d.displayValue; })

            // Measurement labels.
            measurementLabel
                .attr('x', function (d) {
                    return VIZ_LABEL_AREA_WIDTH + xScale(d.dateRounded);
                })
                .attr('y', yPos + 15)
                .attr('text-anchor', 'middle')
                .attr('class', 'hidden label label-measure')
                .style('fill', colors.measureLabel)
                .text(function (d) { return d.displayValue; })

            // Target labels
            targetLabel
                .attr('x', function (d) {
                    return VIZ_LABEL_AREA_WIDTH + xScale(d.dateRounded);
                })
                .attr('y', yPos - 10)
                .attr('text-anchor', 'middle')
                .attr('class', 'hidden label label-target')
                .style('fill', colors.targetLabel)
                .text(function (d) { return d.displayValue; })
            /*
            text
                .attr('y', j*20+25)
                .attr('x',function (d, i) { return xScale(d[0])-5; })
                .attr('class','value')
                .text(function (d){ return d[1]; })
                .style('fill', mockupColor)
                .style('display','none');
            */

            // Labels for each indicator
            g.append('text')
                .attr('x', 10)
                .attr('y', yPos - 24)
                .attr('text-anchor', 'start')
                .text(indicator['indicator_name'])
                .style('fill', colors.indicatorLabel)
                .classed('indicator-name', true)
                .on('mouseover', _onMouseoverIndicator)
                .on('mouseout', _onMouseoutIndicator)
                .on('click', _onClickIndicator);
        };

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

        //             * * *   TODAY INDICATOR   * * *             //

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

        // Get the maximum height of the visualization area
        var vizHeight = document.querySelector('.viz-area').getBoundingClientRect().height;

        // Set this height on the SVG element
        $('#viz').css('height', vizHeight);

        // Add the today line
        var gToday = svg.append('g').attr('class', 'today');

        var todayYStart  = -30,
            todayYEnd    = vizHeight - 30,
            todayYHeight = todayYEnd - todayYStart

        // Create the today line
        var today     = new Date(),
            todayRounded = _roundDateToHalfYear(today),
            todayXPos = VIZ_LABEL_AREA_WIDTH + xScale(todayRounded),
            todayLine = gToday.selectAll('line')
                .data([today])
                .enter()
                .append('line')
                .attr('x1', todayXPos)
                .attr('x2', todayXPos)
                .attr('y1', todayYStart)
                .attr('y2', todayYEnd); // TODO: Don't hardcode the end point

        // Special rect shape for interaction hover area
        /*
        var todayHoverRect = gToday.append('rect')
            .classed('hoverable', true)
            .attr('x', todayXPos - 5)
            .attr('y', todayYStart)
            .attr('width', '10')
            .attr('height', todayYHeight)
            .on('mouseover.today', _onMouseoverToday)
            .on('mouseout.today', _onMouseoutToday);
            */

        // Add a label for the indicator that appears on hover
        var todayLabel = gToday.append('text')
            .attr('x', todayXPos)
            .attr('y', todayYEnd)
            .attr('text-anchor', 'middle')
            .text('Now')
            .classed('label-today', true);

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

        //                * * *   FUNCTIONS   * * *                //

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

        function _onMouseoverIndicator (p) {
            var g = d3.select(this).node().parentNode;
            d3.select(g).selectAll('.circle-subtargets').classed('show', true);
            d3.select(g).selectAll('.circle-latest').classed('show', true);
            d3.select(g).selectAll('.label').classed('hidden', false);
            d3.select(g).selectAll('circle').attr('opacity', 0.20);
        }

        function _onMouseoutIndicator (p) {
            var g = d3.select(this).node().parentNode;
            d3.select(g).selectAll('.circle-subtargets').classed('show', false);
            d3.select(g).selectAll('.circle-latest').classed('show', false);
            if (!d3.select(g).classed('active')) {
                d3.select(g).selectAll('.label').classed('hidden', true);
                d3.select(g).selectAll('circle').attr('opacity', 1);
            }
        }

        function _onMouseoverToday (p) {
            var g = d3.select(this).node().parentNode;
            d3.select(g).select('text').style('display', 'block');
        }
        function _onMouseoutToday (p) {
            var g = d3.select(this).node().parentNode;
            d3.select(g).select('text').style('display', 'none');
        }

        function _onClickIndicator () {
            var g = d3.select(this).node().parentNode;
            var gAll = d3.select(g).node().parentNode;

            //if ($(this).hasClas)

            // Deselect all indicators
            d3.select(gAll).selectAll('.active').classed('active', false);
            d3.select(gAll).selectAll('.circle-subtargets').classed('show', false);
            d3.select(gAll).selectAll('.circle-latest').classed('show', false);
            d3.select(gAll).selectAll('.label').classed('hidden', true);
            d3.select(gAll).selectAll('circle').attr('opacity', 1);

            // Clear info box
            $('#info-title').text('');
            $('#info-metadata').empty();
            $('#info-description').empty();

            // Just show the one clicked
            d3.select(g).classed('active', true);
            d3.select(g).selectAll('.circle-subtargets').classed('show', true);
            d3.select(g).selectAll('.circle-latest').classed('show', true);
            d3.select(g).selectAll('.label').classed('hidden', false);
            d3.select(g).selectAll('circle').attr('opacity', 0.20);

            // Display the infos below
            var title = $(this).closest('.indicator').find('.indicator-name').text();
            $('#info-title').text(title);

            var indicator = _.findWhere(data, { indicator_name: title });
            $('#info-metadata').append('<strong>Project:</strong> ' + indicator.project_name + '<br>');
            $('#info-metadata').append('<strong>Status:</strong> ' + indicator.status + '<br>');
            $('#info-metadata').append('<strong>Baseline measurement:</strong> ' + indicator.baseline.displayString + '<br>');
            $('#info-metadata').append('<strong>Target goal:</strong> ' + indicator.target.displayString + '<br>');
            for (var i = 0; i < indicator.description.length; i++) {
                var paragraph = indicator.description[i];
                $('#info-description').append('<p>' + paragraph + '</p>');
            }
            $('#info-description').append('<p><a href="#">View the raw data behind this indicator.</a></p>');
        }

    }

    // UTILITY FUNCTIONS

    // Parse dates and values from database API response
    function _parseData (data) {
        for (var k = 0; k < data.length; k++) {
            var units = data[k].units;

            // Data transformations that will make things handy for us later
            data[k].baseline = _transformMeasurement(data[k].baseline, units);
            data[k].target = _transformMeasurement(data[k].target, units);
            for (var j = 0; j < data[k].measurements.length; j++) {
                data[k].measurements[j] = _transformMeasurement(data[k].measurements[j], units);
            }

            // Other information to encode
            data[k].targetIsIncreasing = _isTargetIncreasing(data[k]);
            data[k].projectedValue = _getProjectedValue(data[k]);
            data[k].progress = _getProgress(data[k]);
        }

        return data;
    }

    // Format and transform measurement data to useful bits
    function _transformMeasurement (measurement, units) {
        measurement.date          = new Date(Date.parse(measurement.date));
        measurement.dateRounded   = _roundDateToHalfYear(measurement.date);
        measurement.value         = parseFloat(measurement.value);
        measurement.units         = units;
        measurement.displayValue  = measurement.value.toLocaleString();
        measurement.displayString = _parseValueForDisplay(measurement);

        return measurement;
    }

    // Given a value and units, create a string suitable for display
    function _parseValueForDisplay (measurement) {
        var value = measurement.value,
            units = measurement.units,
            displayValue = value.toLocaleString(),
            displayUnits = '';

        if (units.toLowerCase() === 'number') {
            displayUnits = 'units';
        } else if (units.toLowerCase().substring(0, 7) === 'percent') {
            displayUnits = 'percent';
        } else {
            displayUnits = units;
        }

        return displayValue + ' ' + displayUnits;
    }

    // Get entries to populate filter dropdowns
    function _getEntriesForFilter (data, field) {
        // Uses underscore.js chaining.
        // (1) Selects all the values of a given `field`
        // (2) Sorts alphabetically - TODO: Guarantee alphabetic sort, this only sorts by ASCII code right now, which is close
        // (3) and filters by unique values (faster to do this after sorting)
        return _.chain(data)
                .pluck(field)
                .sort()
                .uniq(true)
                .value();
    }

    // Determine whether an indicator's target is increasing
    function _isTargetIncreasing (indicator) {
        return (indicator.baseline.value < indicator.target.value) ? true : false;
    }

    // Get a number code describing whether indicator is progressing
    function _getProgress (indicator) {
        /*
        Progress codes
        [0] Progress unknown (not enough measurements) - GRAY
        [1] Target not reached (failure) - RED!
        [2] Needs improvement (if trend continues, projected failure) - LIGHT RED / ORANGE
        [3] NOT USED (Yellow)
        [4] On target (if trend continues, projected success) - LIGHT GREEN
        [5] Target reached (success) - GREEN!
        */

        // If there are no measurements, we can't tell what the progress is.
        // Return code zero
        if (indicator.measurements.length < 1) {
            return 0
        }

        var baseline     = indicator.baseline,
            target       = indicator.target,
            measurements = indicator.measurements,
            latest       = measurements[measurements.length - 1],
            today        = new Date()

        // For targets that are increasing
        if (indicator.targetIsIncreasing) {
            // If target date has passed
            if (target.date < today) {
                // and the most recent measurement has surpassed the target?
                if (latest.value >= target.value) {
                    return 5
                // and the most recent measurement has not surpassed the target?
                } else {
                    return 1
                }
            // Else if the target date near today or in the future
            } else {
                // and the projected value at target date is greater than the target?
                if (latest.value >= target.value) {
                    return 4
                // and the projected value at target date is not greater than the target?
                } else {
                    return 2
                }
            }
        // Else, this target is decreasing
        } else {
            if (target.date < today) {
                // and the most recent measurement has surpassed the target?
                if (latest.value <= target.value) {
                    return 5
                // and the most recent measurement has not surpassed the target?
                } else {
                    return 1
                }
            // Else if the target date near today or in the future
            } else {
                // and the projected value at target date is greater than the target?
                if (latest.value <= target.value) {
                    return 4
                // and the projected value at target date is not greater than the target?
                } else {
                    return 2
                }
            }
        }
        // TODO
        // return _.random(0, 5);
    }

    function _getProgressColor (code) {
        return INDICATOR_COLOR_SCALE[code];
    }

    // Returns data array in a different order intended for visualization
    function _sortDataInDisplayOrder (data) {
        return _.sortBy(data, function (indicator) {
            return (indicator.targetIsIncreasing) ? 0 : 1;
        });
    }

    // Figure out what the projected value is
    function _getProjectedValue (indicator) {

    }

    // Gets the earliest start date for the visualization, based on earliest baseline date of provided data.
    function _getStartDate (data) {
        var date;

        for (var i = 0; i < data.length; i++) {
            var test = data[i].baseline.dateRounded;
            if (!date || test.getTime() < date.getTime()) {
                date = test;
            }
        }

        return date;
    }

    // Gets the latest end date for the visualization, based on latest target date of provided data.
    function _getEndDate (data) {
        var date;

        // Assumes that earliest start date for visualization is a baseline date.
        for (var i = 0; i < data.length; i++) {
            var test = data[i].target.dateRounded;
            if (!date || test.getTime() > date.getTime()) {
                date = test;
            }
        }

        return date;
    }

    // Round a given Date object to the nearest 6 months, using D3.
    function _roundDateToHalfYear (date) {
        // TODO: Verify that this is returning optimal rounding
        // TODO: What happens if a rounded date is the same as another measurement?
        var lowerRange = d3.time.month.offset(date, -3);
        var upperRange = d3.time.month.offset(date, 3);
        return d3.time.month.range(lowerRange, upperRange, 6)[0];
    }

    // Returns an object of subtarget dates and values between baseline and target
    function _makeSubtargets (indicator) {
        var baseline   = indicator.baseline;
        var target     = indicator.target;

        var trendMode  = parseInt($('#debug-trend').val());

        // Get all the dates between baseline (inclusive) and target (exclusive)
        var interval = d3.time.month.range(baseline.dateRounded, target.dateRounded, 6);

        var subtargets = [],
            divisor    = interval.length;

        // Significant digits

        //Function: getSigFigFromNum( num ), provides the significant digits of a number.
        //@num must be a number (base 10) that is a string. example "01"
        var getSigFigFromNum = function( num ){
            if( isNaN( +num ) ){
                throw new Error( "getSigFigFromNum(): num (" + num + ") is not a number." );
            }
            // We need to get rid of the leading zeros for the numbers.
            num = num.toString();
            num = num.replace( /^0+/, '');
            // re is a RegExp to get the numbers from first non-zero to last non-zero
            var re = /[^0](\d*[^0])?/;
            return ( /\./.test( num ) )? num.length - 1 : (num.match( re ) || [''])[0].length;
        };

        var baselineSigfig = getSigFigFromNum(baseline.value);
        var targetSigfig = getSigFigFromNum(target.value);
        var sigfig = Math.max(baselineSigfig, targetSigfig);
        // don't use sig 0
        if (sigfig < 1) sigfig = 1;

        // Start making a new subtarget array.
        // Note: we start counting at 1 because position 0 of the interval array
        // is the baseline date, which we don't need again.
        for (var i = 1; i < interval.length; i++) {

            if (target.value > baseline.value) {
                // If target is increasing
                var difference = target.value - baseline.value;
                var delta      = (difference / interval.length) * i;
                var subvalue   = baseline.value + delta;
            } else {
                // If target is decreasing, flip the calculations
                var difference = baseline.value - target.value;
                var delta      = (difference / interval.length) * i;
                var subvalue   = baseline.value - delta;
            }

            subtargets.push({
                date:  interval[i],
                value: parseFloat(subvalue.toPrecision(sigfig))
            });
        }

        return subtargets;

    }

    function _optionGetColors (mode) {
        switch (parseInt(mode)) {
            case 3: // Original
                return {
                    indicatorLabel:  VIZ_MAIN_COLOR,
                    baselineCircle:  VIZ_ACCENT_COLOR,
                    measureCircle:   VIZ_MAIN_COLOR,
                    subtargetCircle: VIZ_ACCENT_COLOR,
                    targetCircle:    VIZ_ACCENT_COLOR,
                    latestCircle:    VIZ_MAIN_COLOR,
                    baselineLabel:   VIZ_ACCENT_COLOR,
                    measureLabel:    VIZ_MAIN_COLOR,
                    targetLabel:     VIZ_ACCENT_COLOR
                }
                break;
            case 2: // All blue
                return {
                    indicatorLabel:  ARTF_COLOR_GREEN,
                    baselineCircle:  ARTF_COLOR_BLUE,
                    measureCircle:   ARTF_COLOR_LTBLUE,
                    subtargetCircle: ARTF_COLOR_LTBLUE,
                    targetCircle:    ARTF_COLOR_BLUE,
                    latestCircle:    ARTF_COLOR_LTBLUE,
                    baselineLabel:   ARTF_COLOR_BLUE,
                    measureLabel:    ARTF_COLOR_BLUE,
                    targetLabel:     ARTF_COLOR_BLUE
                }
                break;
            case 1: // ARTF Color scheme
            default:
                return {
                    indicatorLabel:  ARTF_COLOR_GREEN,
                    baselineCircle:  ARTF_COLOR_ORANGERED,
                    measureCircle:   ARTF_COLOR_BLUE,
                    subtargetCircle: ARTF_COLOR_ORANGERED,
                    targetCircle:    ARTF_COLOR_ORANGERED,
                    latestCircle:    ARTF_COLOR_BLUE,
                    baselineLabel:   ARTF_COLOR_ORANGERED,
                    measureLabel:    ARTF_COLOR_BLUE,
                    targetLabel:     ARTF_COLOR_ORANGERED
                }
                break;
        }
    }

})(jQuery);
