var activekmlLayer = "";
var ss = sessionStorage;
var center_usa = [39.83333, -98.585522];
var map;
var base_layer;

function render_rms_kml(kmltext) {
   const parser = new DOMParser();

   // Create new kml overlay
   var kml = parser.parseFromString(kmltext, 'text/xml');
   var track = new L.KML(kml);

   map.addLayer(track);
   activekmlLayer = track;

   return track;
}

function update_kml(file, map) {
   // not found in cache, download it and store
   fetch(file).then(res => res.text()).then(kmltext => {
      render_rms_kml(kmltext);
   });
}

$(document).ready(function() {
   // XXX: show a tool-tip on the button briefly on the button
   $('div#links').hide();

   // leaflet setup
   var mapOptions = {
      center: center_usa,
      zoom: 4,
   }
   map = new L.map('rms-map', mapOptions);
   base_layer = new L.TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      minZoom: 4,
      maxZoom: 14
   });
   map.addLayer(base_layer);

   var graphicScale = L.control.graphicScale({
      fill: 'fill',
      doubleLine: true,
      showSubunits: true
   }).addTo(map);

   let polylineMeasure = L.control.polylineMeasure ({position:'topleft', unit:'kilometres', showBearings:true, clearMeasurementsOnStop: false, showClearControl: true, showUnitControl: true})
   polylineMeasure.addTo (map);

   function debugevent(e) { console.debug(e.type, e, polylineMeasure._currentLine) }

   map.on('polylinemeasure:toggle', debugevent);
   map.on('polylinemeasure:start', debugevent);
   map.on('polylinemeasure:resume', debugevent);
   map.on('polylinemeasure:finish', debugevent);
   map.on('polylinemeasure:change', debugevent);
   map.on('polylinemeasure:clear', debugevent);
   map.on('polylinemeasure:add', debugevent);
   map.on('polylinemeasure:insert', debugevent);
   map.on('polylinemeasure:move', debugevent);
   map.on('polylinemeasure:remove', debugevent);

   L.control.mouseCoordinate({
      gps: true,
      gpsLong: false,
      nac: false,
      qth: true,
      utm: false,
      utmref: true
   }).addTo(map);

//  ionicons webfont
//   L.AwesomeMarkers.Icon.prototype.options.prefix = 'ion';
   // menu
   $('a#toggle_links').click(function(e) {
      $('div#links').toggle();
      e.preventDefault();
   });
   
   // mode selector
   $('#mode').change(function() {
      // Load kml file
      if (activekmlLayer != "") {
         map.removeLayer(activekmlLayer);
         activekmlLayer = "";
      }
      var kml_file = 'rms-' + $('#mode').val() + '.kml';
      console.log("Loading kml_file: " + kml_file);
      update_kml(kml_file, map);
   });

/* XXX: make this reset the page zoom on leaving a field
   $('input').blur(function() {
   });
*/
   var kml_file = 'rms-' + $('#mode').val() + '.kml';
   update_kml(kml_file, map);
   // scale the map to fit all nodes
   // XXX: make this a toggle
//   const bounds = activekmlLayer.getBounds();
//   map.fitBounds(bounds);


});
