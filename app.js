var map = L.map('map', { fadeAnimation: false });
var hash = new L.Hash(map);

if (document.location.href.indexOf('#') == -1)
    if (!setViewFromCookie())
        map.setView([51.591, 24.609], 5);

var mapnik = L.tileLayer.grayscale('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
}).addTo(map);

var esri = L.tileLayer('https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: "<a href='https://wiki.openstreetmap.org/wiki/Esri'>Terms & Feedback</a>",
      maxZoom: 19,
      maxNativeZoom: 19,
      ref: "esric"
    })

var baseMaps = {
    "Mapnik": mapnik,
    "Esri Clarity": esri,
};

var layerControl = L.control.layers(baseMaps, null, { position: 'bottomright' });

L.control.locate({ drawCircle: false, drawMarker: true }).addTo(map);

//------------- GitHub control ------------------

L.Control.Link = L.Control.extend({
    onAdd: map => {
        var div = L.DomUtil.create('div', 'leaflet-control-layers control-padding control-bigfont');
        div.innerHTML += '<a target="_blank" href="https://github.com/zetx16/addr-duplicates">GitHub</a>';
        return div;
    }
});

new L.Control.Link({ position: 'bottomright' }).addTo(map);

//------------- OsmLink analyze control --------------------

L.Control.OsmId = L.Control.extend({
    onAdd: map => {
        var div = L.DomUtil.create('div', 'leaflet-control-layers control-padding control-bigfont');
        var input = $('<input type="text" placeholder="osm id" class="control-input" id="place">')
        var button = $('<button class="control-button" id="btn-link">Analyze link</button>')
        button.click(analyzeLink)
        var buttonBbox = $('<button class="control-button" id="btn-bbox">Analyze bbox</button>')
        buttonBbox.click(analyzeBbox)
        var buttonPlace = $('<button class="control-button" id="btn-place">Analyze place</button>')
        buttonPlace.click(analyzePlace)
        $(div).append(input).append(button).append(buttonBbox).append(buttonPlace)
        div.onmousedown = div.ondblclick = div.onpointerdown = L.DomEvent.stopPropagation;
        //div.oninput = setDate;
        return div;
    }
});

new L.Control.OsmId({ position: 'topright' }).addTo(map);

//------------- LaneInfo control --------------------

L.Control.LaneInfo = L.Control.extend({
    onAdd: map => {
        var div = L.DomUtil.create('div', 'leaflet-control-layers control-padding');
        div.id = 'laneinfo';
        div.onclick = div.onpointerdown = div.onmousedown = div.ondblclick = L.DomEvent.stopPropagation;
        div.style.display = 'none';
        return div;
    }
});

//new L.Control.LaneInfo({ position: 'topright' }).addTo(map);

//----------------------------------------------------

var lanes = [];

var overpassUrl = 'https://overpass-api.de/api/interpreter?data='
var overpassQuery = '[out:csv(::lat, ::lon, "addr:street", "addr:housenumber", "addr:suburb"; false)][timeout:25];(nwr["addr:street"]["addr:housenumber"]({{bbox}}););out center;'

var nominatimUrl = 'https://nominatim.openstreetmap.org/reverse?format=json&zoom=10'
var placeOsmId, placeOsmType

// ------------- functions -------------------

function analyze(url) {
    $('.control-button').prop('disabled', true);
    $.ajax(url).then(parseContent).then(render)
        .then(()=>$('.control-button').prop('disabled', false))
        .catch(()=>$('.control-button').prop('disabled', false))
}

function analyzeBbox() {
    var bounds = map.getBounds();
    var bbox = [bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast()].join(',');
    
    var url = overpassUrl + encodeURIComponent(overpassQuery.replace('{{bbox}}', bbox))
    analyze(url)
}


function analyzeLink() {
    var value = $('#place').val()
    var id = value.match(/\d+/)
    var type = /\b(w|way)(?=\b|\d)/.test(value) ? 'way' : 'relation'
    if (!id)  return
    id = parseInt(id[0])
    id = type === 'way' ? 2400000000 + id : 3600000000 + id
    var area = 'area:' + id

    var url = overpassUrl + encodeURIComponent(overpassQuery.replace('{{bbox}}', area))
    analyze(url)
}

function analyzePlace() {
    var id = parseInt(placeOsmId)
    id = placeOsmType === 'way' ? 2400000000 + id : 3600000000 + id
    var area = 'area:' + id

    var url = overpassUrl + encodeURIComponent(overpassQuery.replace('{{bbox}}', area))
    analyze(url)
}

function parseContent(content) {
    var addrs = {}
    for (var line of content.split('\n')) {
        var addr = line.split('\t')
        var key = addr[2] + addr[3] + addr[4]
        var value = { lat: addr[0], lon: addr[1] }
        if(addrs[key])
            addrs[key].push(value)
        else
            addrs[key] = [value]
    }
    var duplicatePairs = []
    for (var key in addrs) {
        if(addrs[key].length <= 1)
            continue
        var duplicateGroup = addrs[key]
        for (var i = 1; i < duplicateGroup.length; i++) {
            duplicatePairs.push({
                line: [duplicateGroup[0], duplicateGroup[i]]
            })
        }
    }

    return duplicatePairs
}

function render(dublicates){
    for(var duplicate of dublicates)
        lanes.push(L.polyline(duplicate.line,
            {
                color: 'red',
                weight: 2,
            })
            .addTo(map))
}

function setLocationCookie() {
    var center = map.getCenter();
    var date = new Date(new Date().getTime() + 10 * 365 * 24 * 60 * 60 * 1000);
    document.cookie = 'location=' + map.getZoom() + '/' + center.lat + '/' + center.lng + '; expires=' + date;
}

function setViewFromCookie() {
    var location = document.cookie.split('; ').find((e, i, a) => e.startsWith('location='));
    if (location == undefined)
        return false;
    location = location.split('=')[1].split('/');

    map.setView([location[1], location[2]], location[0]);
    return true;
}

function setMinDistance() {

}

function redraw() {
    for (var lane in lanes)
        lanes[lane].setStyle({ color: getColorByDate(lanes[lane].options.conditions) });
}

function mapMoveEnd() {
    setLocationCookie()
    $.ajax(nominatimUrl + '&lat=' + map.getCenter().lat + '&lon=' + map.getCenter().lng)
        .done(resp => {
            var btn = $('#btn-place')
            var place = resp.address.city || resp.address.town || resp.address.village || resp.address.hamlet
            if (place) {
                btn.show()
                btn.html('Analyze <span style="color:green">' + place + '</span>')
                placeOsmId = resp.osm_id
                placeOsmType = resp.osm_type
            } else
                btn.hide()
        })
}

map.on('moveend', mapMoveEnd);
//map.on('click', closeLaneInfo);
