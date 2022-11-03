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

var hgs = HamGridSquare;

var mapOptions = {
   center: center_usa,
   fullscreenControl: true,
   loadingControl: true,
   zoom: 4,
   minZoom: 1,
   maxZoom: 15,
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
   mode: 'rms-ardop',
   my_qth: null,
   map_center: center_usa,
   show_coordinates: true,
   show_edge_markers: false,
   show_lit_earth: true,
   show_magnifier: true,
   show_measuring: true,
   show_tz: true,
   units: 'landmiles',
   use_tile_cache: true
};
var config = factory_config;

// Togglable things
var coordinates;
var edgeMarkerLayer;
var layer_switcher;
var lit_earth;
var magnifyingGlass;
var offline_tools;
var polylineMeasure;
var scale_bar;
var time_zones;

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
   console.debug("[update_settings_html] updating forms");
   $('input#auto_zoom').checked = config.auto_zoom;
   $('select#bands').val(config.bands);
   $('select#basemap').val(config.basemap);
   $('input#help_at_start').val(config.help_at_start);
   $('input#mag_show_markers').val(config.mag_show_markers);
   $('input#mode').val(config.mode);
   $('input#my_qth').val(config.my_qth);
   $('input#show_coordinates').val(config.show_coordinates);
   $('input#show_edge_markers').val(config.show_edge_markers);
   $('input#show_lit_earth').val(config.show_lit_earth);
   $('input#show_magnifier').val(config.show_magnifier);
   $('input#show_measuring').val(config.show_measuring);
   $('input#show_tz').val(config.show_tz);
   $('input#use_tile_cache').val(config.use_tile_cache);
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
function toggle_auto_zoom() {
   config.auto_zoom = $('input#autozoom').prop('checked');
}

function toggle_coordinates() {
   config.show_coordinates = $('input#show_coordinates').prop('checked');

   console.log("set show_coordinates: ", config.show_coordinates);
   if (config.show_coordinates) {
      if (coordinates === undefined || coordinates == null) {
         coordinates = L.control.mouseCoordinate({
            gps: true,
            gpsLong: false,
            nac: false,
            qth: true,
            utm: false,
            utmref: true
         });
         coordinates.addTo(map);
      }
   } else {
      if (coordinates !== undefined && coordinates != null) {
         if (map.hasLayer(coordinates)) {
            map.removeLayer(coordinates);
            delete coordinates;
         } else
           alert("nooo");
      } else
         alert("wut?");
   }
}

function toggle_edge_markers() {
   config.show_edge_markers = $('input#show_edge_markers').prop('checked');

   if (config.show_edge_markers) {
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

function toggle_help() {
   if (help_loaded == false) {
      fetch('help.html').then(res => res.text()).then(htmldata => {
         $('div#helpcontainer').html(htmldata);
         help_loaded = true;
        $('div#helpcontainer').show();
      });
   } else
      $('div#helpcontainer').toggle();

   $('#menu').hide();
}

function toggle_lit_earth() {
   config.show_lit_earth = $('input#show_lit_earth').prop('checked');

   if (config.show_lit_earth) {
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

function toggle_magnifier() {
   config.show_magnifier = $('input#show_magnifier').prop('checked');

   if (config.show_magnifier) {
      if (magnifyingGlass == undefined || magnifyingGlass == null) {
         magnifyingGlass = L.magnifyingGlass({
            zoomOffset: 3,
            maxZoom: 15,
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

function toggle_measuring() {
   config.show_measuring = $('input#show_measuring').prop('checked');

   if (config.show_measuring) {
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

function toggle_offline_tools() {
   config.use_tile_cache = $('input#use_tile_cache').prop('checked');
   if (config.use_tile_cache) {
      offline_tools = L.control.savetiles(basemap, {
        // optional zoomlevels to save, default current zoomlevel
        zoomlevels: [13, 15],
        confirm(layer, successCallback) {
          // eslint-disable-next-line no-alert
          if (window.confirm(`Save ${layer._tilesforSave.length}`)) {
            successCallback();
          }
        },
        confirmRemoval(layer, successCallback) {
          // eslint-disable-next-line no-alert
          if (window.confirm('Remove all the tiles?')) {
            successCallback();
          }
        },
        saveText:
          '<i class="fa fa-download" aria-hidden="true" title="Save tiles"></i>',
        rmText: '<i class="fa fa-trash" aria-hidden="true"  title="Remove tiles"></i>',
      });
      offline_tools.addTo(map);
   } else {
      if (map.hasLayer(offline_tools))
         map.removeLayer(offline_tools);
   }
}

function toggle_tz() {
   config.show_tz = $('input#show_tz').prop('checked')

   if (config.show_tz) {
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

// Set all togglable elements to match the active configuration
function update_all() {
   toggle_auto_zoom();
   toggle_coordinates();
   toggle_edge_markers();
   toggle_magnifier();
   toggle_measuring();
   toggle_lit_earth();
//   toggle_offline_tools();
   update_statusbar();
   toggle_tz();
}

function set_qth(coords) {
   console.log("[set_qth] ", coords, " called, parsing...");
   $('input#my_qth').val(coords);	// store into form
   config.my_qth = coords;
   // XXX: place a marker
}

function start_keymode() {
   $(document).keypress(function(event) {
      // Don't capture keystrokes in form fields
      if ($('input').is(":focus") ||
          $('select').is(":focus") ||
          $('textarea').is(":focus")) {
//         console.log("Ignoring, in input field");

	 // allow catching <enter> to pass (submit forms, etc)
         if (event.which != 13)
            return;
      }

      if (event.which == 13) {
         // qth input is focused?
         if ($('input#my_qth').is(":focus")) {
            if ($('input#my_qth') != '') {
               set_qth($('input#my_qth').val());
            } else
               alert('Please enter a QTH location');
         }
         event.preventDefault();
      }

      if (event.which == 104 || event.which == 72) { // h/H
         toggle_help();
         event.preventDefault();
      } else if (event.which == 109 || event.which == 77) { // m/M
         $('div#menu').toggle();
         event.preventDefault();
      } else if (event.which == 113 || event.which == 81) { // q/Q
         var newqth;

         if ($('input#my_qth').val() == '') {
            // Prompt for QTH
            newqth = prompt('Enter QTH as decimal wgs-84 lat, long or [maidenhead]')
         } else {
            newqth = $('input#my_qth').val();
         }

         // apply it
         if (newqth != null)
            set_qth(newqth);
         event.preventDefault();
      } else
         console.log("Unknown keypress: " + event.which);
   });
}

////////////////////////////////
function toggle_layer_switcher() {
   // layer switcher control
   const layer_switcher = L.control
     .layers({
       'osm (offline)': baseLayer,
     }, null, { collapsed: false })
     .addTo(map);
   storageLayer(baseLayer, layer_switcher);
}

/*
// events while saving a tile layer
let progress, total;
const showProgress = debounce(() => {
  document.getElementById('progressbar').style.width = `${(progress/total) * 100}%`;
  document.getElementById('progressbar').innerHTML = progress;  
  if(progress === total) {
    setTimeout(() => document.getElementById('progress-wrapper').classList.remove('show'), 1000);    
  }
}, 10);

baseLayer.on('savestart', (e) => {
  progress = 0;
  total = e._tilesforSave.length;
  document.getElementById('progress-wrapper').classList.add('show');  
  document.getElementById('progressbar').style.width = '0%';
});
baseLayer.on('savetileend', () => {
  progress += 1;     
  showProgress();
});
*/
////////////////////////////////

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
   $('input#save_settings').click(function(e) { save_settings(); });
   $('input#factory_reset').click(function(e) { factory_reset(); });

   $('select#basemap').change(function() {
      alert("Switching basemaps is not yet supported");
      var tv = $('select#basemap').val()
      $('#t_basemap').text(tv);
   });

   $('a#toggle_menu').click(function(e) { $('div#menu').toggle(); e.preventDefault(); });
   $('#help_toggle').click(function(e) { toggle_help(); });
   $('select#mode').change(function() { change_layer($('select#mode').val()); });
   $('input#set_qth').click(function() {
      var newqth = $('input#my_qth').val();

      if (newqth != '')
         set_qth(newqth);
      else
         alert("Please set your QTH in the input box before clicking the button");
   });
   $('input#autozoom').click(function(e) { toggle_auto_zoom(); });
   $('input#show_coordinates').change(function() { toggle_coordinates(); });
   $('input#show_edge_markers').change(function() { toggle_edge_markers(); });
   $('input#show_lit_earth').change(function() { toggle_lit_earth(); });
   $('input#show_magnifier').change(function() { toggle_magnifier(); });
   $('input#show_measuring').change(function() { toggle_measuring(); });
   $('input#show_tz').change(function() { toggle_tz(); });
   $('input#use_tile_cache').change(function() {
//      toggle_offline_tools($(this).prop('checked'));
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

   //////////////////////
   // initalize things //
   //////////////////////
   start_keymode();
   load_basemap();
   change_layer($('select#mode').val());
   update_all();
   if (config.help_at_start)
      toggle_help();
});
