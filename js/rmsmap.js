// Some ugly code to render a nice map of the various layers
// my scripts generate.
//
var ss = sessionStorage;
var ls = localStorage
var center_usa = [39.83333, -98.585522];
var map;
var layers = [ ];
var last_layer = 0;
var scale_bar;

var activekmlLayer = "";

var mapOptions = {
   center: center_usa,
   zoom: 4,
   loadingControl: true,
   fullscreenControl: true,
   zoomControl: false		// so we can use extended zoom controls
};

var config = {
   basemap: 'otm',
   help_at_start: false,
   mag_show_markers: false,
   my_qth: null,
   map_center: center_usa,
   show_edge_markers: false,
   show_lit_earth: true,
   show_tz: true,
   units: 'landmiles'
};

// Togglable things
var edgeMarkerLayer;
var lit_earth;
var time_zones;

////////////////////////////////////////////////

///////////////////////
// Refresh statusbar //
///////////////////////
function update_statusbar() {
   // Text strings
   $('#t_band').text($('select#band').val());
   $('#t_basemap').text($('select#basemap').val());
   $('#t_mode').text($('select#mode').val());
   $('#t_zoom').text(map.getZoom());
}

// Load settings from local storage
function load_settings() {
   /* load setting from localStorage if available */
   var lstmp;

   if ((lstmp = ls.getItem('basemap')) !== null) {
      config.basemap = lstmp;
   }

   if ((lstmp = ls.getItem('help_at_start')) !== null) {
      if (lstmp == false) {
         config.help_at_start = false;
      } else {
         config.help_at_start = true;
      }
   }

   if ((lstmp = ls.getItem('mag_show_markers')) !== null) {
      if (lstmp == false) {
         config.mag_show_markers = false;
      } else {
         config.mag_show_markers = true;
         $('div#help').show();
      }
   }

   if ((lstmp = ls.getItem('my_qth')) !== null) {
      config.my_qth = lstmp;
   }

   if ((lstmp = ls.getItem('map_center')) !== null) {
      config.map_center = lstmp;
   }

   if ((lstmp = ls.getItem('show_edge_markers')) !== null) {
      config.show_edge_markers = lstmp;
   }

   if ((lstmp = ls.getItem('show_lit_earth')) !== null) {
      config.show_lit_earth = lstmp;
   }

   if ((lstmp = ls.getItem('show_tz')) !== null) {
      config.show_tz = lstmp;
   }
}

// change the active displayed mode
function set_mode(mymode) {
   // unload old layer
   if (activekmlLayer != "") {
      map.removeLayer(activekmlLayer);
      activekmlLayer = "";
   }

   var kml_file = mymode + '.kml';
   find_or_load_layer(mymode, kml_file);
}

// Find a layer in the cache or add it
function find_or_add_layer(name, layer) {
   var i, sz;

   if (last_layer == 0)
      sz = 0;
   else
      sz = last_layer - 1;

   console.log("sz: " + sz + " last_layer: " + last_layer);
   for (i = 0; i <= sz; i++) {
      console.log("test i: " + i);
      console.log(layers[i]);

      if (layers[i] === undefined) {
         console.log("skipping no li");
         break;
      }

      if (layers[i].name === undefined) {
         console.log("skipping no lin");
         break;
      }

      if (layers[i].name.match(name)) {
         console.log("* using cached layer " + name);
         return layers[i].layer;
      }
   }

   // This lets us search for an existing layer without loading it
   if (layer === null) {
      console.log("* cache miss for layer " + name);
      return null;
   }

   console.log("* storing layer " + name + " as " + last_layer);
   layers[last_layer] = {
       layer: layer,
       name: name
   };
   last_layer++;
   return layer;
}

// Locate an existing instance of the instance or load from file
function find_or_load_layer(name, file) {
   var layer;

   // is it already in the cache?
   if ((layer = find_or_add_layer(name, null) !== null)) {
      return layer;
   }

   /* XXX: parse the filename to decide what kind of layer it is - kml only for now */
   // fetch the file
   layer = load_kml(name, file);
   return find_or_add_layer(name, layer);
}

function map_append_layer(map, track) {
   map.addLayer(track);
   activekmlLayer = track;

   // scale the map to fit all nodes
   if ($('input#autozoom').prop('checked')) {
      const bounds = activekmlLayer.getBounds();
      map.fitBounds(bounds);
   }
}

function load_kml(name, kmltext) {
   var i, found = false;

   var i = find_or_add_layer(name, null);

   if (i !== null) {
      console.log("* found cached layer " + name);
      found = true;
   }

   var track;
   if (!found) {
      var kml_file = $('#mode').val() + '.kml';
      console.log("* downloading " + kml_file + "...");
      fetch(kml_file).then(res => res.text()).then(kmltext => {
         const parser = new DOMParser();
         var kml = parser.parseFromString(kmltext, 'text/xml');
         track = new L.KML(kml);
         map_append_layer(map, track);
      });
   } else {
      track = layers[i].layer;
      map_append_layer(map, track);
   }
   update_statusbar();
   return track;
}

////////////////////////////

function toggle_edge_markers() {
   if ($('input#edge_markers').prop('checked')) {
      edgeMarkerLayer = L.edgeMarker({
         findEdge : function(map){
             return L.bounds([200,0],map.getSize());
         },
         icon: L.icon({ // style markers
            iconUrl : 'images/edge-arrow-marker.png',
            clickable: true,
            iconSize: [48,48],
            iconAnchor: [24, 24]
         })
      }).addTo(map);
   } else {
      if (edgeMarkerLayer !== undefined) {
//         map.removeLayer(edgeMarkerLayer);
         edgeMarkerLayer.destroy();
      }
   }
}

function toggle_lit_earth() {
   if ($('input#lit_earth').prop('checked')) {
      lit_earth = L.terminator();
      lit_earth.addTo(map);
   } else {
      // XXX: Remove day/night from map
      if (lit_earth !== undefined) {
         map.removeLayer(lit_earth);
         delete lit_earth;
      }
   }
}

function toggle_tz() {
   if ($('input#time_zones').prop('checked')) {
      time_zones = L.timezones;
      time_zones.bindPopup(function (layer) {
         return layer.feature.properties.time_zone;
      }).addTo(map);
   } else {
      if (time_zones !== undefined) {
         map.removeLayer(time_zones);
         delete time_zones;
      }
   }
}

function update_scalebar(unit) {
   if (!scale_bar === undefined) {
      map.removeLayer(scale_bar);
   }

   if (unit.match('landmiles')) {
      console.log("* setting units to imperial");
      scale_bar = L.control.betterscale({
         metric: false,
         imperial: true
      });
      scale_bar.addTo(map);
   } else if (unit.match('kilometres')) {
      console.log("* setting units to metric");
      scale_bar = L.control.betterscale({
         metric: true,
         imperial: false
      });
      scale_bar.addTo(map);
   } else
      alert("Unknown scale unit: " + unit + ", cannot setup scalebar");
}

/////////////////

$(document).ready(function() {
   load_settings();
   map = new L.map('rms-map', mapOptions);

   //////////
   // menu //
   //////////
   $('a#toggle_menu').click(function(e) {
      $('div#menu').toggle();
      e.preventDefault();
   });

   /////////////////////
   // basemap setting //
   /////////////////////
   $('select#basemap').change(function() {
      var tv = $('select#basemap').val()
      $('#t_basemap').text(tv);
      alert("Switching basemaps is not yet supported");
   });

   ///////////////////
   // mode selector //
   ///////////////////
   $('select#mode').change(function() {
      set_mode($('select#mode').val());
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
   update_scalebar(config.units);

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

   ////////////////
   // EdgeMarker //
   ////////////////
   toggle_edge_markers();
   $('input#edge_markers').change(function() {
       toggle_edge_markers();
   });

   ///////////////
   // day/night //
   ///////////////
   toggle_lit_earth();
   $('input#lit_earth').change(function() {
      toggle_lit_earth();
   });

   ///////////////
   // timezones //
   ///////////////
   toggle_tz();
   $('input#time_zones').change(function() {
      toggle_tz();
   });

   /////////////
   // zooming //
   /////////////
   var zoom_bar = new L.Control.ZoomBar({position: 'topright'}).addTo(map);
   map.on('zoomend', function() {
     var currentZoom = map.getZoom();
     update_statusbar();
     /* XXX: Scale the markers */
   });

   var basemap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
   });
   basemap.addTo(map);

   ///////////////
   // magnifier //
   ///////////////
   var tileUrl;
   var tileOptions = { };
   var magTileOptions = { };

   if (/*('#t_basemap').val.match('otm')*/ true) {
      tileUrl = 'https://b.tile.opentopomap.org/{z}/{x}/{y}.png';
      tileOptions = {
         attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
         subdomains: '1234',
         maxZoom: 14
      };
      magTileOptions = {
         attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
         subdomains: '1234',
         maxZoom: 14
      };
   } else if (('#t_basemap').val().match('osm')) {
      tileUrl = 'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png';
      tileOptions = {
         attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
         subdomains: '1234',
         maxZoom: 14
      };
      magTileOptions = {
         attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
         subdomains: '1234',
         maxZoom: 14
      };
   }
   var magnifyingGlass = L.magnifyingGlass({
      zoomOffset: 3,
      layers: [
        L.tileLayer(tileUrl, magTileOptions)
      ]
   });

   // Handle left click (
   magnifyingGlass.on('click', function(e) {
      if (config.mag_show_markers == true) {
         config.mag_show_markers = false;
      } else {
         config.mag_show_markers = true;
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
   //  ionicons webfont
//   L.AwesomeMarkers.Icon.prototype.options.prefix = 'ionic';
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

   //////////////////////
   // initalize things //
   //////////////////////
   set_mode();
   update_statusbar();
});
