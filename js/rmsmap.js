// Some ugly code to render a nice map of the various layers
// my scripts generate.
//
var ss = sessionStorage;
var ls = localStorage
var center_usa = [39.83333, -98.585522];
var map;
var tileUrl;
var tileOptions = { };
var magTileOptions = { };

// layer cache
var layers = [ ];
var last_layer = 0;
var activekmlLayer = "";

var mapOptions = {
   center: center_usa,
   zoom: 4,
   loadingControl: true,
   fullscreenControl: true,
   zoomControl: false		// so we can use extended zoom controls
};

var help_loaded = false;	// have we succesfully fetched help dialog?

// increment if you change the configuration significantly
var config_version = 1;
var factory_config = {
   auto_zoom: false,
   bands: [ ],
   basemap: 'otm',
   help_at_start: true,
   mag_show_markers: false,
   magnifier: true,
   mode: 'rms-ardop',
   my_qth: null,
   map_center: center_usa,
   show_edge_markers: false,
   show_lit_earth: true,
   show_tz: true,
   units: 'landmiles'
};
var config = factory_config;

// Togglable things
var edgeMarkerLayer;
var polylineMeasure;
var lit_earth;
var time_zones;
var scale_bar;
var coordinates;
var magnifyingGlass;

////////////////////////////////////////////////

// Load factory settings
function factory_reset() {
   var do_reset = confirm("Are you sure you want to factory reset?");
   
   if (do_reset) {
      console.log("[factory reset] CONFIRMED");
      config = factory_config;
   } else
      console.log("[factory reset] CANCELLED");

   update_settings_html();
}

// Load settings from local storage
function load_settings() {
   var lstmp;
   var need_upgrade = false;

   if ((lstmp = ls.getItem('myconfig_version')) != null) {
      if (config_version > lstmp) {
         need_upgrade = true;
      }
   }

   if ((lstmp = ls.getItem('myconfig')) != null) {
      // Decode it
      var pc = JSON.parse(lstmp);

      if (pc != null && pc !== undefined) {
         config = pc;
         console.log("[load_settings] from localStorage success");
      } else {
         console.log("[load_settings] from localStorage failed");
      }
   } else {
     console.log("[load_settings] from localStorage: not found");
   }
   update_settings_html();

   if (need_upgrade) {
      console("[load_settings] upgrading saved configuration (v" + lstmp + ") to latest (v" + config_version + ")");
      save_settings();
   }
}

function save_settings() {
   var res = ls.setItem('myconfig', JSON.stringify(config));
   ls.setItem('myconfig_version', config_version);
   console.log("[save_settings] to localStorage");
}

///////////////////////
// Refresh statusbar //
///////////////////////
function update_statusbar() {
   // Text strings
   // XXX: this will need exploded with commas?
   $('#t_bands').text($('select#bands').val());
   $('#t_basemap').text($('select#basemap').val());
   $('#t_mode').text($('select#mode').val());
   $('#t_zoom').text(map.getZoom());
   if (config.auto_zoom) {
      $('#t_auto_zoom').text("(auto)");
   } else {
      $('#t_auto_zoom').text('');
   }
}

// Set the html entities to reflect the loaded configuration
// this should match the HTML
function update_settings_html() {
   $('input#auto_zoom').checked = config.auto_zoom;
   $('select#bands').val(config.bands);
   $('select#basemap').val(config.basemap);
   $('input#help_at_start').val(config.help_at_start);
   $('input#mag_show_markers').val(config.mag_show_markers);
   $('input#show_magnifier').val(config.magnifier);
   $('input#mode').val(config.mode);
   $('input#my_qth').val(config.my_qth);
   $('input#show_edge_markers').val(config.show_edge_markers);
   $('input#show_lit_earth').val(config.show_lit_earth);
   $('input#show_tz').val(config.show_tz);
   console.debug("* finished loading settings, applying.");
}
     
// change the active displayed mode
function change_layer(name) {
   var found = false;
   var track;

   console.log("[change_layer] switching overlay to " + name);
   // unload old layer before doing anything else...
   if (activekmlLayer != "") {
      map.removeLayer(activekmlLayer);
      activekmlLayer = "";
   }

   if (layers[name] !== undefined && layers[name] != null) {
      track = layers[name].layer;
      found = true;
      console.log("[CACHE] found layer " + name);
   }

   if (!found) {
       var kml_file = name + '.kml';
       var kml_file = $('#mode').val() + '.kml';
       console.log("[FETCH] downloading " + kml_file + "...");

       var getreq = $.ajax({
          url: kml_file,
          async: false,
          beforeSend: function(xhr) {
             xhr.overrideMimeType( "text/html" );
          },
          xhrFields: {
             dataType: 'text/html',
             withCredentials: true
          },
          success: function(kmltext) {
             const parser = new DOMParser();
             var kml = parser.parseFromString(kmltext, 'text/xml');
             track = new L.KML(kml);
             console.log("[FETCH] download succesful for layer " + name + " from " + kml_file);
          },
          fail: function() {
             alert("Unable to download layer " + name + " :(");
             console.log("[FETCH] failed downloading layer " + name + " from " + kml_file);
          }
       });

       if (track === undefined || track == null) {
          alert("Unable to switch to layer " + name);
          return null;
       }

       if (track !== undefined && track != null) {
          console.log("[CACHE] storing layer " + name);
          layers[name] = {
             layer: track,
             name: name
          }
       }
   }

   if (!map.hasLayer(track))
      map.addLayer(track);

   // selected as active overlay layer
   activekmlLayer = track;

   // scale the map to fit all nodes
   if (config.auto_zoom) {
      const bounds = track.getBounds();
      map.fitBounds(bounds);
   }

   update_statusbar();
   return track;
}


////////////////////////////

function toggle_edge_markers() {
   if ($('input#show_edge_markers').prop('checked')) {
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
         edgeMarkerLayer.destroy();
      }
   }
}

function toggle_lit_earth() {
   if ($('input#show_lit_earth').prop('checked')) {
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
   if ($('input#show_tz').prop('checked')) {
      time_zones = L.timezones;

      // XXX: We need to improve the popup, disabling for now
/*
      time_zones.bindPopup(function (layer) {
         return layer.feature.properties.time_zone;
      });
*/
      time_zones.addTo(map);
   } else {
      if (time_zones !== undefined) {
         map.removeLayer(time_zones);
         delete time_zones;
      }
   }
}

function toggle_magnifier() {
   if ($('input#show_magnifier').prop('checked')) {
      if (magnifyingGlass == undefined || magnifyingGlass == null) {
         magnifyingGlass = L.magnifyingGlass({
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

         // XXX: Move this out to do_contextmenu()
         map.on('contextmenu', function(e) {
           if (map.hasLayer(magnifyingGlass)) {
              map.removeLayer(magnifyingGlass);
           } else {
              if ($('input#show_magnifier').prop('checked')) {
                 map.addLayer(magnifyingGlass);
                 magnifyingGlass.setLatLng(e.latlng);
              }
           }
         });
      }
   } else {
      if (magnifyingGlass !== undefined && magnifyingGlass !== null) {
         if (map.hasLayer(magnifyingGlass)) {
            map.removeLayer(magnifyingGlass);
         }
      }
   }
}

function toggle_autozoom() {
   if ($('input#autozoom').prop('checked')) {
      config.auto_zoom = true;
   } else {
      config.auto_zoom = false;
   }
}

function toggle_coordinates() {
   if ($('input#show_tz').prop('checked')) {
      coordinates = L.control.mouseCoordinate({
         gps: true,
         gpsLong: false,
         nac: false,
         qth: true,
         utm: false,
         utmref: true
      }).addTo(map);
   } else {
      if (coordinates !== undefined) {
//         map.removeLayer(coordinates);
         coordinates.remove();
      }
   }
}

///////////////
// measuring //
///////////////
function toggle_measuring() {
   if ($('input#show_measuring').prop('checked')) {
      if (polylineMeasure === undefined || polylineMeasure === null) {
         polylineMeasure = L.control.polylineMeasure ({
            position:'topleft',
            unit: config.units,
            showBearings:true,
            clearMeasurementsOnStop: false,
            showClearControl: true,
            showUnitControl: true
         });
         map.on('polylinemeasure:toggle', polylinemeasureDebugevent);
         map.on('polylinemeasure:start', polylinemeasureDebugevent);
         map.on('polylinemeasure:resume', polylinemeasureDebugevent);
         map.on('polylinemeasure:finish', polylinemeasureDebugevent);
         map.on('polylinemeasure:change', polylinemeasureDebugevent);
         map.on('polylinemeasure:clear', polylinemeasureDebugevent);
         map.on('polylinemeasure:add', polylinemeasureDebugevent);
         map.on('polylinemeasure:insert', polylinemeasureDebugevent);
         map.on('polylinemeasure:move', polylinemeasureDebugevent);
         map.on('polylinemeasure:remove', polylinemeasureDebugevent);
      }

      if (!map.hasLayer(polylineMeasure))
         polylineMeasure.addTo(map);
   } else {
//      if (polylineMeasure !== undefined && polylineMeasure !== null) {
//         map.remove(polylineMeasure);
//      }
   }
}

function update_scale(unit) {
   if (!scale_bar === undefined) {
      map.removeLayer(scale_bar);
   }

   if (unit.match('landmiles')) {
      console.log("[CONFIG] setting units to imperial");
      scale_bar = L.control.betterscale({
         metric: false,
         imperial: true
      });
      scale_bar.addTo(map);
   } else if (unit.match('kilometres')) {
      console.log("[CONFIG] setting units to metric");
      scale_bar = L.control.betterscale({
         metric: true,
         imperial: false
      });
      scale_bar.addTo(map);
   } else {
      alert("Unknown scale unit: " + unit + ", cannot defaulting to imperial");
      scale_bar = L.control.betterscale({
         metric: true,
         imperial: false
      });
      scale_bar.addTo(map);
   }
}

function load_basemap() {
/*
   var bmi = $('input#basemap option:selected');
   if (bmi.val().match('otm')) {
*/
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
/*
   } else if (bmi.val().match('osm')) {
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
*/
}

function polylinemeasureDebugevent(e) {
   console.debug(e.type, e, polylineMeasure._currentLine)
}

/////////////////

// Set all togglable elements to match the active configuration
function update_all() {
   toggle_coordinates();
   toggle_edge_markers();
   toggle_magnifier();
   toggle_measuring();
   toggle_lit_earth();
   toggle_tz();
   toggle_autozoom();
   update_statusbar();
}

$(document).ready(function() {
   load_settings();
   map = new L.map('rms-map', mapOptions);

   var basemap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
   });
   basemap.addTo(map);

   //////////
   // menu //
   //////////
   $('a#toggle_menu').click(function(e) {
      $('div#menu').toggle();
      e.preventDefault();
   });

   $('input#save_settings').click(function(e) {
      save_settings();
   });

   $('input#factory_reset').click(function(e) {
      factory_reset();
   });

   $('input#autozoom').click(function(e) {
      toggle_autozoom();
   });

   $('select#basemap').change(function() {
      alert("Switching basemaps is not yet supported");
      var tv = $('select#basemap').val()
      $('#t_basemap').text(tv);
   });

   $('select#mode').change(function() {
      change_layer($('select#mode').val());
   });

   $('input#show_edge_markers').change(function() {
      toggle_edge_markers();
   });

   $('input#show_lit_earth').change(function() {
      toggle_lit_earth();
   });

   $('input#show_measuring').change(function() {
      toggle_measuring();
   });

   $('input#show_tz').change(function() {
      toggle_tz();
   });

   $('input#show_magnifier').change(function() {
      toggle_magnifier();
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

   /////////////
   // markers //
   /////////////
   //  ionicons webfont
//   L.AwesomeMarkers.Icon.prototype.options.prefix = 'ionic';

   /////////////////
   // help dialog //
   /////////////////
   $('a#help_toggle').click(function(e) {
      if (help_loaded == false) {
         fetch('help.html').then(res => res.text()).then(htmldata => {
            $('div#helpcontainer').html(htmldata);
            help_loaded = true;
           $('div#helpcontainer').show();
         });
      } else
         $('div#helpcontainer').toggle();
      $('#menu').hide();
      e.preventDefault();
   });
   //////////////////////
   // initalize things //
   //////////////////////
   change_layer($('select#mode').val());
   load_basemap();
   update_all();
});
