var activekmlLayer = "";
var ss = sessionStorage;
var ls = localStorage
var center_usa = [39.83333, -98.585522];
var map;
var base_layer;
var show_help = true;
var magnifierShowMarkers = false;
var layers = [];
var mapOptions = {
   center: center_usa,
   zoom: 4,
   loadingControl: true,
   fullscreenControl: true
}

////////////////////////////////////////////////

///////////////////////
// Refresh statusbar //
///////////////////////
function update_statusbar() {
   $('#t_mode').text($('#mode').val());
   $('#t_band').text($('#band').val());
   $('#t_zoom').text(map.getZoom());
}

// Load settings from local storage
function load_settings() {
   /* load setting from localStorage if available */
   var lstmp;
   if ((lstmp = ls.getItem('alwaysshowhelp')) !== null) {
      if (lstmp == false) {
         show_help = false;
      } else {
         show_help = true;
         $('div#help').show();
      }
   }
   // default basemap
   // last mode
}

// Find a layer in the cache or add it
function find_or_add_layer(name, layer) {
  var i;

  for (i = 0; i < layers.length; i++) {
     if (layers[i].name.match(name)) {
        console.log("* Found stored layer " + name);
        return layers[i];
     }
  }

  if (layer === null) {
     console.log("* Cache miss for layer " + name);
     return null;
  }

  console.log("* Storing layer " + name);
  console.log(layer);
  layers[name] = layer;
  return layer;
}

function render_rms_kml(name, kmltext) {
   var i, sz = layers.length, found = false;

   for (i = 0; i < sz; i++) {
      if (layers[i].name.match(name)) {
         console.log("* Found stored layer " + name);
         found = true;
         break;
      }
   }

   if (!found) {
      const parser = new DOMParser();
      // Create new kml overlay
      var kml = parser.parseFromString(kmltext, 'text/xml');
      var track = new L.KML(kml);
      activekmlLayer = track;
   } else {
      activekmlLayer = track = layers[i];
   }
   map.addLayer(track);

   // scale the map to fit all nodes
   if ($('input#autozoom').prop('checked')) {
      const bounds = activekmlLayer.getBounds();
      map.fitBounds(bounds);
   }
   update_statusbar();
   return track;
}

function update_kml(name, file, map) {
//   var mytrack = find_or_add_layer(name, null);
//   if (mytrack !== null) {
//      render_rms_xml(kmltext);
//   } else {
      fetch(file).then(res => res.text()).then(kmltext => {
         render_rms_kml(name, kmltext);
      });
//   }
}

$(document).ready(function() {
   load_settings();
   map = new L.map('rms-map', mapOptions);

   //////////
   // menu //
   //////////
   $('a#toggle_links').click(function(e) {
      $('div#links').toggle();
      e.preventDefault();
   });

   ///////////////////
   // mode selector //
   ///////////////////
   $('#mode').change(function() {
      var mymode = $('#mode').val();
      // Load kml file
      if (activekmlLayer != "") {
         map.removeLayer(activekmlLayer);
         activekmlLayer = "";
      }
      var kml_file = mymode + '.kml';
      console.log("Loading kml_file: " + kml_file);
      update_kml(mymode, kml_file, map);
   });

   ///////////////
   // measuring //
   ///////////////
   let polylineMeasure = L.control.polylineMeasure ({position:'topleft', unit:'kilometres', showBearings:true, clearMeasurementsOnStop: false, showClearControl: true, showUnitControl: true})
   polylineMeasure.addTo (map);

   function debugevent(e) {
      console.debug(e.type, e, polylineMeasure._currentLine)
   }

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

   ///////////////
   // Scale bar //
   ///////////////
   var graphicScale = L.control.graphicScale({
      fill: 'fill',
      doubleLine: true,
      showSubunits: true
   }).addTo(map);

   /////////////////////
   // coordinates box //
   /////////////////////
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
   

   /////////////
   // zooming //
   /////////////
   map.on('zoomend', function() {
     var currentZoom = map.getZoom();
     update_statusbar();
     /* XXX: Scale the markers */
   });

   //////////////////////
   // basemap switcher //
   //////////////////////
   new L.basemapsSwitcher([
     {
       layer: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
         attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
       }),
//       icon: './assets/images/img3.PNG',
       name: 'opentopomap'
     },
     {
       layer: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
         attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
       }).addTo(map),
//       icon: './assets/images/img1.PNG',
       name: 'openstreetmap'
     },
   ], {
      position: 'topright'
   }).addTo(map);

   ///////////////
   // magnifier //
   ///////////////
   var tileUrl = 'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png';
//   var tileUrl = 'https://b.tile.opentopomap.org/{z}/{x}/{y}.png';
   var tileOptions = {
      attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
//      attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
      subdomains: '1234',
      maxZoom: 14
   };
   var magnifyingGlass = L.magnifyingGlass({
      zoomOffset: 3,
      layers: [
        L.tileLayer(tileUrl, tileOptions)
      ]
   });

   // Handle left click (
   magnifyingGlass.on('click', function(e) {
      if (magnifierShowMarkers == true) {
         magnifierShowMarkers = false;
      } else {
         magnifierShowMarkers = true;
      }
   });

   // ...and reappear on right click
   map.on('contextmenu', function(e) {
     if (map.hasLayer(magnifyingGlass)) {
        map.removeLayer(magnifyingGlass);
     } else {
        map.addLayer(magnifyingGlass);
        magnifyingGlass.setLatLng(e.latlng);
     }
   });

   /////////////
   // markers //
   /////////////
   $('div.leaflet-popup-content-wrapper').on('contextmenu', function(e) {
      console.log("Menu NYI");
      return false;
   });
   $('div.leaflet-popup-content-wrapper').on('click', function(e) {
      console.log("Click!");
      console.log(e);
      $(this).hide();
   });

   /////////////////
   // help dialog //
   /////////////////
   fetch('help.html').then(res => res.text()).then(htmldata => {
      $('div#help').html(htmldata);
      $('div#help').show();
   });

   //////////////////
   // load dataset //
   //////////////////
   var kml_file = $('#mode').val() + '.kml';
   update_kml($('#mode').val(), kml_file, map);
});
