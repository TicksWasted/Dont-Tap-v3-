setTimeout(function(){

     var exdays = 1000;
     function setCookie(cname, cvalue) {
  var d = new Date();
  d.setTime(d.getTime() + (exdays*24*60*60*1000));
  var expires = "expires="+ d.toUTCString();
  document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/donttap";
}

     function getCookie(cname) {
  var name = cname + "=";
  var decodedCookie = decodeURIComponent(document.cookie);
  var ca = decodedCookie.split(';');
  for(var i = 0; i <ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return decodeURIComponent(c.substring(name.length, c.length));
    }
  }
  return "";
}




var PatRec=[];
var FreRec=[];
// Records loaded from localStorage after helpers are defined (see loadRecords)
var key;
var timerGO = null;
var Bonus = 0;
var TimeL = 0;
var sc=0,B5;

// ========== Settings + Hitsounds + Custom Cursor ==========
var SETTINGS = {
  volume: 0.5,
  cursorSize: 32,
  cursorColor: '#ffffff',
  hitSound: 'none',
  jingleEnabled: false,
  jingleVolume: 0.5,
  showMeter: true,
  meterMode: 'overall', // 'segment' = per multiplier band | 'overall' = progress to 5x
  useSystemCursor: false,
  showCps: true,
  startOnAnyKey: true,
  countdownSec: 0,
  boardBg: '#ffffff',
  tileColor: '#000000',
  missColor: '#AF1800',
  scoreColor: '#800080',
  hiscoreColor: '#00008b',
  timeColor: '#000000',
  multColor: '#9e21a1',
  lineColor: '#F0B3FF',
  meterFillColor: '#f460ff'
};

try {
  var saved = localStorage.getItem('donttap_settings');
  if (saved) SETTINGS = Object.assign(SETTINGS, JSON.parse(saved));
  if (SETTINGS.hitSound === 'click5') SETTINGS.hitSound = 'click';
  if (SETTINGS.hitSound === 'pop5') SETTINGS.hitSound = 'pop';
  if (typeof SETTINGS.countdownSec !== 'number' || isNaN(SETTINGS.countdownSec)) SETTINGS.countdownSec = 0;
  SETTINGS.countdownSec = Math.max(0, Math.min(3, SETTINGS.countdownSec));
  if (typeof SETTINGS.jingleVolume !== 'number' || isNaN(SETTINGS.jingleVolume)) SETTINGS.jingleVolume = SETTINGS.volume;
  SETTINGS.jingleVolume = Math.max(0, Math.min(1, SETTINGS.jingleVolume));
  if (!SETTINGS.lineColor) SETTINGS.lineColor = '#F0B3FF';
} catch(e) {}

function saveSettings() {
  try { localStorage.setItem('donttap_settings', JSON.stringify(SETTINGS)); } catch(e) {}
}

// --- Persistent records (localStorage – survives app restart) ---
function saveRecords() {
  try {
    localStorage.setItem('donttap_records', JSON.stringify(FreRec || []));
    localStorage.setItem('donttap_recordsP', JSON.stringify(PatRec || []));
  } catch(e) {}
}
function loadRecords() {
  try {
    var r = localStorage.getItem('donttap_records');
    var p = localStorage.getItem('donttap_recordsP');
    if (r) FreRec = JSON.parse(r);
    if (p) PatRec = JSON.parse(p);
  } catch(e) {}
}
function resetAllRecords() {
  FreRec = [];
  PatRec = [];
  saveRecords();
  try {
    if (typeof FreList === 'function') FreList();
    if (typeof Best !== 'undefined' && Best) Best.innerHTML = 'HI-SCORE<br>-';
  } catch(e) {}
}
loadRecords(); // restore scores from previous sessions

// --- Audio (pooled so rapid taps don't cut each other off) ---
var HIT_SRCS = {
  click: 'click5.wav',
  pop: 'pop5.wav',
  pop2: 'saya_cute.wav',
  blop: 'blop_2.wav',
  drum: 'drum.wav',
  minecraft: 'minecraft_hit-old.wav',
  bell: 'bell6.wav',
  anime: 'anime.wav'
};
var hitAudio = {};
var hitPools = {};
var POOL_SIZE = 6;
for (var hitKey in HIT_SRCS) {
  hitAudio[hitKey] = new Audio(HIT_SRCS[hitKey]);
  hitAudio[hitKey].preload = 'auto';
  hitPools[hitKey] = [];
  for (var pi = 0; pi < POOL_SIZE; pi++) {
    var clone = new Audio(HIT_SRCS[hitKey]);
    clone.preload = 'auto';
    hitPools[hitKey].push(clone);
  }
}

function ensureAudio() {
  try {
    for (var k in hitAudio) {
      hitAudio[k].volume = SETTINGS.volume;
      var pool = hitPools[k] || [];
      for (var i = 0; i < pool.length; i++) pool[i].volume = SETTINGS.volume;
    }
    if (typeof jingleAudio !== 'undefined' && jingleAudio) jingleAudio.volume = SETTINGS.jingleVolume;
  } catch(e) {}
}

function playHit() {
  try {
    if (SETTINGS.hitSound === 'none') return;
    var key = SETTINGS.hitSound;
    var pool = hitPools[key] || hitPools.pop;
    if (!pool || !pool.length) {
      var a = hitAudio[key] || hitAudio.pop;
      a.volume = SETTINGS.volume;
      a.currentTime = 0;
      a.play().catch(function(){});
      return;
    }
    var pick = null;
    for (var i = 0; i < pool.length; i++) {
      if (pool[i].paused || pool[i].ended) { pick = pool[i]; break; }
    }
    if (!pick) pick = pool[0];
    pick.volume = SETTINGS.volume;
    try { pick.currentTime = 0; } catch(e) {}
    pick.play().catch(function(){});
  } catch(e) {}
}

function playMiss() {
  // fail sound removed by request
}

// --- Multiplier-up jingle ---
var jingleAudio = new Audio('minecraft_xp-gain.wav');
jingleAudio.preload = 'auto';
var jinglePlaying = false;
jingleAudio.addEventListener('ended', function() { jinglePlaying = false; });
jingleAudio.addEventListener('pause', function() { jinglePlaying = false; });
function playMultJingle(force) {
  if (!SETTINGS.jingleEnabled && !force) return;
  if (jinglePlaying && !force) return; // one shot — don't restart mid-jingle
  try {
    var vol = (typeof SETTINGS.jingleVolume === 'number') ? SETTINGS.jingleVolume : 0.5;
    jingleAudio.volume = vol;
    jingleAudio.currentTime = 0;
    jinglePlaying = true;
    var p = jingleAudio.play();
    if (p && p.catch) p.catch(function(){ jinglePlaying = false; });
  } catch(e) { jinglePlaying = false; }
}
var lastMultLevel = 1; // highest multiplier already jingled this run
var runHits = 0;
var runMisses = 0;
var runMaxMult = 1;
var runStartedAt = 0;

function panelsOpen() {
  var s = document.getElementById('settingsPanel');
  var c = document.getElementById('colorsPanel');
  return (s && s.style.display === 'block') || (c && c.style.display === 'block');
}
function closePanels() {
  var s = document.getElementById('settingsPanel');
  var c = document.getElementById('colorsPanel');
  if (s) s.style.display = 'none';
  if (c) c.style.display = 'none';
  if (typeof layoutFloatingPanels === 'function') layoutFloatingPanels();
}
function resetRunStats() {
  runHits = 0;
  runMisses = 0;
  runMaxMult = 1;
  runStartedAt = performance.now();
}
function formatCps(hits, elapsedMs) {
  var sec = Math.max(0.1, elapsedMs / 1000);
  return (hits / sec).toFixed(1);
}
var countdownActive = false;
var countdownGen = 0;
var countdownTimer = null;
var countdownOverlay = null;

function ensureCountdownOverlay() {
  if (countdownOverlay) return countdownOverlay;
  countdownOverlay = document.createElement('div');
  countdownOverlay.id = 'countdownOverlay';
  countdownOverlay.style.cssText = 'display:none;position:absolute;z-index:40;align-items:center;justify-content:center;pointer-events:none;font-family:Allerta Stencil,sans-serif;font-weight:bold;color:#f460ff;text-shadow:0 2px 12px rgba(0,0,0,0.55);background:rgba(0,0,0,0.28);';
  document.body.appendChild(countdownOverlay);
  return countdownOverlay;
}
function positionCountdownOverlay() {
  var el = ensureCountdownOverlay();
  if (typeof x0 === 'undefined' || typeof w === 'undefined') return;
  el.style.left = x0 + 'px';
  el.style.top = (w / 4) + 'px';
  el.style.width = w + 'px';
  el.style.height = w + 'px';
  el.style.fontSize = Math.max(48, Math.round(w * 0.38)) + 'px';
}
function cancelCountdown() {
  countdownGen++;
  countdownActive = false;
  if (countdownTimer) { clearTimeout(countdownTimer); countdownTimer = null; }
  if (countdownOverlay) countdownOverlay.style.display = 'none';
}
function startCountdown(done) {
  cancelCountdown();
  var sec = Number(SETTINGS.countdownSec);
  if (!(sec > 0)) {
    countdownActive = false;
    if (typeof done === 'function') done();
    return;
  }
  var myGen = countdownGen;
  countdownActive = true;
  var el = ensureCountdownOverlay();
  positionCountdownOverlay();
  el.style.display = 'flex';
  var left = sec;
  function showStep() {
    if (myGen !== countdownGen) return;
    if (left <= 0) {
      el.textContent = 'GO';
      countdownTimer = setTimeout(function() {
        if (myGen !== countdownGen) return;
        countdownActive = false;
        el.style.display = 'none';
        if (typeof done === 'function') done();
      }, 180);
      return;
    }
    el.textContent = String(Math.ceil(left));
    var step = Math.min(1, left);
    left = Math.round((left - step) * 10) / 10;
    countdownTimer = setTimeout(showStep, step * 1000);
  }
  showStep();
}

function showRunSummary(mode) {
  if (!SETTINGS.showCps || !PressKey) return;
  var elapsed = performance.now() - (runStartedAt || performance.now());
  var cps = formatCps(runHits, elapsed);
  if (mode === 'frenzy') {
    PressKey.innerHTML = 'Press a key to start<br><span style="font-size:0.55em">' +
      cps + ' CPS · max x' + runMaxMult + ' · ' + runHits + ' hits</span>';
  } else if (mode === 'pattern') {
    PressKey.innerHTML = 'Press a key to start<br><span style="font-size:0.55em">' +
      runHits + ' tiles · ' + (runMisses ? 'missed' : 'clean') + '</span>';
  }
}

// --- Cursor (recolor + resize the attached cursor.png) ---
var cursorBaseImg = null;
(function loadCursorBase() {
  var img = new Image();
  img.onload = function() {
    cursorBaseImg = img;
    applyCursor();
  };
  img.src = 'cursor.png';
})();

// Builds a canvas containing the custom cursor image scaled to `size` and
// tinted to SETTINGS.cursorColor. Shared by the live CSS cursor (applyCursor)
// and the on-tile fail mark (DrawError) so both always match.
function buildTintedCursorCanvas(size) {
  if (!cursorBaseImg) return null;
  var color = SETTINGS.cursorColor || '#ffffff';

  var c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  var ctx = c.getContext('2d');

  ctx.drawImage(cursorBaseImg, 0, 0, size, size);

  try {
    var imgData = ctx.getImageData(0, 0, size, size);
    var d = imgData.data;
    var r = parseInt(color.slice(1,3), 16) / 255;
    var g = parseInt(color.slice(3,5), 16) / 255;
    var b = parseInt(color.slice(5,7), 16) / 255;
    for (var i = 0; i < d.length; i += 4) {
      if (d[i+3] > 0) {
        // treat original as grayscale-ish and tint
        var lum = (d[i] + d[i+1] + d[i+2]) / 3 / 255;
        d[i]   = Math.min(255, Math.round(r * 255 * (0.4 + lum * 0.8)));
        d[i+1] = Math.min(255, Math.round(g * 255 * (0.4 + lum * 0.8)));
        d[i+2] = Math.min(255, Math.round(b * 255 * (0.4 + lum * 0.8)));
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } catch(e) {}

  return c;
}

function applyCursor(sizeOverride) {
  var els = document.querySelectorAll('canvas, #basis, #slider, #switch, #records, button, #settingsBtn, #settingsPanel, #colorsBtn, #colorsPanel');
  if (SETTINGS.useSystemCursor) {
    document.body.style.cursor = 'default';
    for (var i = 0; i < els.length; i++) els[i].style.cursor = '';
    return;
  }
  if (!cursorBaseImg) return;
  var baseSize = Math.max(12, Math.min(64, SETTINGS.cursorSize | 0));
  var size = (typeof sizeOverride === 'number')
    ? Math.max(8, sizeOverride)
    : baseSize;

  var c = buildTintedCursorCanvas(size);
  if (!c) return;

  var url = c.toDataURL('image/png');
  var hot = Math.round(size / 2);
  var css = 'url("' + url + '") ' + hot + ' ' + hot + ', crosshair';
  document.body.style.cursor = css;
  for (var i = 0; i < els.length; i++) els[i].style.cursor = css;
}

function applyFailCursor() {
  if (SETTINGS.useSystemCursor) return;
  var smaller = Math.max(8, (SETTINGS.cursorSize | 0) - 5);
  applyCursor(smaller);
}

function applyGameColors() {
  try {
    if (typeof div !== 'undefined' && div) div.style.backgroundColor = SETTINGS.boardBg || '#ffffff';
    if (typeof Score !== 'undefined' && Score) Score.style.color = SETTINGS.scoreColor || '#800080';
    if (typeof Best !== 'undefined' && Best) Best.style.color = SETTINGS.hiscoreColor || '#00008b';
    if (typeof Time !== 'undefined' && Time) Time.style.color = SETTINGS.timeColor || '#000000';
    if (typeof PressKey !== 'undefined' && PressKey) PressKey.style.color = SETTINGS.multColor || '#9e21a1';
    if (meterFill) meterFill.style.background = SETTINGS.meterFillColor || '#f460ff';
    // Redraw the grid lines
    if (typeof CanvasLines === 'function' && typeof context !== 'undefined' && context) {
      CanvasLines();
    }
    // Redraw tiles with new colors if possible
    if (typeof contextB !== 'undefined' && contextB) {
      if (typeof Errr !== 'undefined' && Errr === 1 && typeof DrawError === 'function') {
        // keep miss tile visible
      } else if (typeof Patt !== 'undefined' && Patt == 1 && typeof DrawBlackPat === 'function') {
        DrawBlackPat();
      } else if (typeof DrawBlack === 'function') {
        DrawBlack();
      }
    }
  } catch(e) {}
}

// --- Settings UI ---
function layoutFloatingPanels() {
  var s = document.getElementById('settingsPanel');
  var c = document.getElementById('colorsPanel');
  var sOpen = s && s.style.display !== 'none';
  var cOpen = c && c.style.display !== 'none';
  if (s) {
    s.style.right = '16px';
    s.style.bottom = '58px';
  }
  if (c) {
    c.style.bottom = '58px';
    if (sOpen && cOpen) {
      var sw = s.offsetWidth || 420;
      c.style.right = (16 + sw + 16) + 'px';
    } else {
      c.style.right = '16px';
    }
  }
}

function buildSettingsUI() {
  var btn = document.createElement('button');
  btn.id = 'settingsBtn';
  btn.innerHTML = '⚙ Settings';
  btn.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:9999;padding:8px 14px;font-family:Allerta Stencil,sans-serif;font-size:14px;background:#1a1a1a;color:#fff;border:2px solid #666;border-radius:6px;cursor:pointer;';
  document.body.appendChild(btn);

  var soundOpts = [
    { v: 'pop', n: 'Pop' },
    { v: 'click', n: 'Click' },
    { v: 'pop2', n: 'Soft' },
    { v: 'blop', n: 'Blop' },
    { v: 'drum', n: 'Drum' },
    { v: 'minecraft', n: 'Craft' },
    { v: 'bell', n: 'Bell' },
    { v: 'anime', n: 'Anime' },
    { v: 'none', n: 'Off' }
  ];
  var soundBtns = soundOpts.map(function(o) {
    return '<button type="button" class="soundChip' + (SETTINGS.hitSound===o.v?' selected':'') + '" data-sound="' + o.v + '">' + o.n + '</button>';
  }).join('');

  var panel = document.createElement('div');
  panel.id = 'settingsPanel';
  panel.style.cssText = 'display:none;position:fixed;bottom:58px;right:16px;z-index:9999;width:420px;background:#111;border:2px solid #555;border-radius:12px;padding:20px 22px;color:#eee;font-family:Allerta Stencil,sans-serif;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,0.6);box-sizing:border-box;';
  panel.innerHTML = [
    '<div style="font-size:20px;margin-bottom:16px;color:#f460ff;letter-spacing:1px;">Settings</div>',
    '<div class="setRow"><label>Hit volume <span id="volVal">' + Math.round(SETTINGS.volume*100) + '%</span></label>',
    '<input type="range" id="volSlider" min="0" max="100" value="' + Math.round(SETTINGS.volume*100) + '"></div>',
    '<div class="setRow"><label>Multiplier jingle volume <span id="jingleVolVal">' + Math.round((SETTINGS.jingleVolume||0)*100) + '%</span></label>',
    '<input type="range" id="jingleVolSlider" min="0" max="100" value="' + Math.round((SETTINGS.jingleVolume||0)*100) + '"></div>',
    '<div class="setRow"><label>Start countdown <span id="cdVal">' + Number(SETTINGS.countdownSec).toFixed(1) + 's</span></label>',
    '<input type="range" id="cdSlider" min="0" max="3" step="0.5" value="' + SETTINGS.countdownSec + '">',
    '<div class="hint">0s starts instantly. Shown on the board before the timer runs.</div></div>',
    '<div class="setRow"><label>Cursor Size <span id="sizeVal">' + SETTINGS.cursorSize + 'px</span></label>',
    '<input type="range" id="sizeSlider" min="16" max="48" value="' + SETTINGS.cursorSize + '"></div>',
    '<div class="setRow"><label>Cursor Color</label>',
    '<input type="color" id="colorPicker" value="' + SETTINGS.cursorColor + '" style="width:100%;height:36px;margin:6px 0 0 0;border:none;background:transparent;"></div>',
    '<div class="setRow"><label>Hit sound</label>',
    '<div class="soundGrid">' + soundBtns + '</div>',
    '<button id="previewSound" class="panelBtn">Preview</button></div>',
    '<div class="checkGrid">',
    '  <label class="chk"><input type="checkbox" id="jingleToggle"' + (SETTINGS.jingleEnabled ? ' checked' : '') + '> Jingle on multiplier up</label>',
    '  <label class="chk"><input type="checkbox" id="systemCursorToggle"' + (SETTINGS.useSystemCursor ? ' checked' : '') + '> Use system cursor</label>',
    '  <label class="chk"><input type="checkbox" id="meterToggle"' + (SETTINGS.showMeter ? ' checked' : '') + '> Show multiplier meter</label>',
    '  <label class="chk"><input type="checkbox" id="cpsToggle"' + (SETTINGS.showCps ? ' checked' : '') + '> Show CPS after run</label>',
    '  <label class="chk"><input type="checkbox" id="anyKeyToggle"' + (SETTINGS.startOnAnyKey ? ' checked' : '') + '> Any key starts (off = Space)</label>',
    '</div>',
    '<div class="setRow"><label>Meter mode</label>',
    '<div class="meterModes">',
    '  <label class="chk"><input type="radio" name="metermode" value="segment"' + (SETTINGS.meterMode!=='overall'?' checked':'') + '> Next multiplier</label>',
    '  <label class="chk"><input type="radio" name="metermode" value="overall"' + (SETTINGS.meterMode==='overall'?' checked':'') + '> Overall to x5</label>',
    '</div></div>',
    '<div class="btnRow">',
    '<button id="resetRecords" class="panelBtn danger">Reset All Records</button>',
    '<button id="closeSettings" class="panelBtn good">Close</button>',
    '</div>'
  ].join('');
  document.body.appendChild(panel);
  panel.style.maxHeight = '82vh';
  panel.style.overflowY = 'auto';

  btn.onclick = function() {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    layoutFloatingPanels();
  };
  document.getElementById('closeSettings').onclick = function() {
    panel.style.display = 'none';
    layoutFloatingPanels();
  };

  document.getElementById('volSlider').oninput = function() {
    SETTINGS.volume = this.value / 100;
    document.getElementById('volVal').textContent = this.value + '%';
    saveSettings();
  };
  document.getElementById('jingleVolSlider').oninput = function() {
    SETTINGS.jingleVolume = this.value / 100;
    document.getElementById('jingleVolVal').textContent = this.value + '%';
    if (jingleAudio) jingleAudio.volume = SETTINGS.jingleVolume;
    saveSettings();
  };
  document.getElementById('cdSlider').oninput = function() {
    SETTINGS.countdownSec = parseFloat(this.value);
    document.getElementById('cdVal').textContent = Number(this.value).toFixed(1) + 's';
    saveSettings();
  };
  var chips = panel.querySelectorAll('.soundChip');
  function markSoundChip(val) {
    for (var ci = 0; ci < chips.length; ci++) {
      if (chips[ci].getAttribute('data-sound') === val) chips[ci].classList.add('selected');
      else chips[ci].classList.remove('selected');
    }
  }
  for (var si = 0; si < chips.length; si++) {
    chips[si].onclick = function() {
      SETTINGS.hitSound = this.getAttribute('data-sound');
      markSoundChip(SETTINGS.hitSound);
      saveSettings();
      playHit();
    };
  }
  document.getElementById('sizeSlider').oninput = function() {
    SETTINGS.cursorSize = parseInt(this.value, 10);
    document.getElementById('sizeVal').textContent = this.value + 'px';
    applyCursor();
    saveSettings();
  };
  document.getElementById('colorPicker').oninput = function() {
    SETTINGS.cursorColor = this.value;
    applyCursor();
    saveSettings();
  };
  document.getElementById('previewSound').onclick = function() {
    playHit();
  };
  document.getElementById('jingleToggle').onchange = function() {
    SETTINGS.jingleEnabled = this.checked;
    saveSettings();
    if (this.checked) { playMultJingle(true); } // quick preview, allow restart
  };
  document.getElementById('systemCursorToggle').onchange = function() {
    SETTINGS.useSystemCursor = this.checked;
    applyCursor();
    saveSettings();
  };
  document.getElementById('meterToggle').onchange = function() {
    SETTINGS.showMeter = this.checked;
    var inGame = (parseFloat(TimeL) > 0 && Errr === 0 && timerWent === true);
    setInGameUI(inGame);
    saveSettings();
  };
  document.getElementById('cpsToggle').onchange = function() {
    SETTINGS.showCps = this.checked;
    saveSettings();
  };
  document.getElementById('anyKeyToggle').onchange = function() {
    SETTINGS.startOnAnyKey = this.checked;
    saveSettings();
  };
  var modeRadios = panel.querySelectorAll('input[name="metermode"]');
  for (var mi = 0; mi < modeRadios.length; mi++) {
    modeRadios[mi].onchange = function() {
      SETTINGS.meterMode = this.value;
      updateMultMeter();
      saveSettings();
    };
  }
  document.getElementById('resetRecords').onclick = function() {
    if (confirm('Delete all high scores? This cannot be undone.')) {
      resetAllRecords();
      alert('Records cleared.');
    }
  };
}

// --- Colors UI (separate panel from Settings) ---
function buildColorsUI() {
  var btn = document.createElement('button');
  btn.id = 'colorsBtn';
  btn.innerHTML = '🎨 Colors';
  btn.style.cssText = 'position:fixed;bottom:12px;right:130px;z-index:9999;padding:8px 14px;font-family:Allerta Stencil,sans-serif;font-size:14px;background:#1a1a1a;color:#fff;border:2px solid #666;border-radius:6px;cursor:pointer;';
  document.body.appendChild(btn);

  var panel = document.createElement('div');
  panel.id = 'colorsPanel';
  panel.style.cssText = 'display:none;position:fixed;bottom:58px;right:16px;z-index:9999;width:280px;background:#111;border:2px solid #555;border-radius:12px;padding:18px;color:#eee;font-family:Allerta Stencil,sans-serif;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,0.6);box-sizing:border-box;';
  panel.innerHTML = [
    '<div style="font-size:16px;margin-bottom:12px;color:#f460ff;">Game Colors</div>',
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 10px;margin-bottom:12px;font-size:12px;">',
    '  <label>Board <input type="color" id="colBoard" value="' + SETTINGS.boardBg + '" style="width:100%;height:28px;border:none;background:transparent;"></label>',
    '  <label>Tiles <input type="color" id="colTile" value="' + SETTINGS.tileColor + '" style="width:100%;height:28px;border:none;background:transparent;"></label>',
    '  <label>Miss <input type="color" id="colMiss" value="' + SETTINGS.missColor + '" style="width:100%;height:28px;border:none;background:transparent;"></label>',
    '  <label>Score <input type="color" id="colScore" value="' + SETTINGS.scoreColor + '" style="width:100%;height:28px;border:none;background:transparent;"></label>',
    '  <label>Hi-Score <input type="color" id="colHiscore" value="' + SETTINGS.hiscoreColor + '" style="width:100%;height:28px;border:none;background:transparent;"></label>',
    '  <label>Timer <input type="color" id="colTime" value="' + SETTINGS.timeColor + '" style="width:100%;height:28px;border:none;background:transparent;"></label>',
    '  <label>Multiplier <input type="color" id="colMult" value="' + SETTINGS.multColor + '" style="width:100%;height:28px;border:none;background:transparent;"></label>',
    '  <label>Grid lines <input type="color" id="colLines" value="' + (SETTINGS.lineColor || '#F0B3FF') + '" style="width:100%;height:28px;border:none;background:transparent;"></label>',
    '  <label>Meter <input type="color" id="colMeter" value="' + SETTINGS.meterFillColor + '" style="width:100%;height:28px;border:none;background:transparent;"></label>',
    '</div>',
    '<button id="resetColors" style="width:100%;padding:6px;margin-bottom:8px;background:#333;color:#fff;border:1px solid #666;border-radius:4px;cursor:pointer;">Reset Colors</button>',
    '<button id="closeColors" style="width:100%;padding:6px;background:#4CAF50;color:#fff;border:none;border-radius:4px;cursor:pointer;">Close</button>'
  ].join('');
  document.body.appendChild(panel);
  panel.style.maxHeight = '80vh';
  panel.style.overflowY = 'auto';

  btn.onclick = function() {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    layoutFloatingPanels();
  };
  document.getElementById('closeColors').onclick = function() {
    panel.style.display = 'none';
    layoutFloatingPanels();
  };

  function bindColor(id, key) {
    var el = document.getElementById(id);
    if (!el) return;
    el.oninput = function() {
      SETTINGS[key] = this.value;
      applyGameColors();
      saveSettings();
    };
  }
  bindColor('colBoard', 'boardBg');
  bindColor('colTile', 'tileColor');
  bindColor('colMiss', 'missColor');
  bindColor('colScore', 'scoreColor');
  bindColor('colHiscore', 'hiscoreColor');
  bindColor('colTime', 'timeColor');
  bindColor('colMult', 'multColor');
  bindColor('colLines', 'lineColor');
  bindColor('colMeter', 'meterFillColor');

  document.getElementById('resetColors').onclick = function() {
    SETTINGS.boardBg = '#ffffff';
    SETTINGS.tileColor = '#000000';
    SETTINGS.missColor = '#AF1800';
    SETTINGS.scoreColor = '#800080';
    SETTINGS.hiscoreColor = '#00008b';
    SETTINGS.timeColor = '#000000';
    SETTINGS.multColor = '#9e21a1';
    SETTINGS.lineColor = '#F0B3FF';
    SETTINGS.meterFillColor = '#f460ff';
    var map = {
      colBoard: 'boardBg', colTile: 'tileColor', colMiss: 'missColor',
      colScore: 'scoreColor', colHiscore: 'hiscoreColor', colTime: 'timeColor',
      colMult: 'multColor', colLines: 'lineColor', colMeter: 'meterFillColor'
    };
    for (var id in map) {
      var el = document.getElementById(id);
      if (el) el.value = SETTINGS[map[id]];
    }
    applyGameColors();
    saveSettings();
  };
}

// Build UI after DOM is ready (game already uses setTimeout wrapper)
setTimeout(function() {
  buildSettingsUI();
  buildColorsUI();
  applyCursor();
  applyGameColors();
}, 300);
// ===============================================================
var Time = document.createElement("div");
var PressKey = document.createElement("div");
var Score = document.createElement("div");
var Errr=0;
var timerWent=true;
var cx,cy,CoX,CoY;
var horT,verT,doit=0,n=0;
var OtherTiles = [];
var good = 1;
var cXX,cYY;
var horiAr = [];
var vertAr = [];
var canvasB = document.createElement('canvas');
var canvas = document.createElement('canvas');
var context;
var ZoomI,wOLD,cXXo,cYYo;
var slider = document.createElement('input');
var div = document.createElement('div');
var zom = document.createElement('div');
var sqsizeD = Math.round(window.innerHeight*0.108);
var sqsize;
var zoomC = getCookie("Zoom");
var ZoomN = parseInt(zoomC, 10);
if (isNaN(ZoomN)) { ZoomN = 110; } // default zoom level on first run
var button = document.createElement("BUTTON");
var Patt;
var PaC=getCookie("Patt");

//PatRec[0]=[1, "today"];
//console.log(PatRec[0][1]);




SetCzoom();
zom.innerHTML="-"+ZoomN+"+";

function SetCzoom()
     {
    sqsize = Math.round(sqsizeD*ZoomN/100);
    w = Math.round(sqsize*4);
    x0 = Math.round(window.innerWidth/2-w/2);
   // y0 = sqsizeD*3-sqsize*(ZoomN-50)/160;
    x1 = w;
    y1 = w;

     }


    div.id = "basis";
    div.style.display = "block";
    div.style.position='absolute';
    div.style.cursor = "inherit";
    div.style.width=w;
    div.style.height=Math.round(w*1.5);
    div.style.left=x0+"px";
    div.style.top=0+"px";
    div.style.backgroundColor='white';
    div.style.pointerEvents='none';
    document.body.appendChild(div);


zom.id = "zom";

    zom.style.display = "block";
    //zom.style.position='absolute';
    zom.style.cursor = "inherit";
    zom.style.color="white";
    zom.style.width="200px";
    zom.style.pointerEvents='none';
    zom.style.textAlign ="center";
    document.body.appendChild(zom);


    slider.id = "slider";
    slider.type = 'range';
    slider.min = 10;
    slider.max = 200;
    slider.value = ZoomN || 100;
    slider.step = 2;
    document.body.appendChild(slider);
slider.addEventListener("input", Zoom);

button.innerHTML = "PATTERNS";
document.body.appendChild(button);
button.id = "switch";
button.style.display = "block";
button.style.position='absolute';

// Patreon link removed

var recordsB = document.createElement("BUTTON");
recordsB.innerHTML = "RECORDS";
document.body.appendChild(recordsB);
recordsB.id = "records";
recordsB.style.display = "block";
recordsB.style.position='absolute';

var Rec=document.createElement("div");
var RecSh=1;
if (getCookie("rec")!="") {RecSh=getCookie("rec");}
if (RecSh==1) {Rec.style.display = "block";}else{Rec.style.display = "none";}
recordsB.addEventListener ("click", function() {
if (RecSh==1) {Rec.style.display = "none"; RecSh=0; setCookie("rec","0");}
else {Rec.style.display = "block"; RecSh=1;setCookie("rec","1");}
});

Rec.id = "listR";


Rec.style.position='absolute';
//Rec.style.padding=sqsize/8+'px';
//Score.style.left=Math.round(w/2.23)+"px";
Rec.style.top=35+"px";
Rec.style.left=0+"px";
Rec.style.zIndex=11;
Rec.style.width='200px';
Rec.style.pointerEvents='none';
Rec.style.color='white';
Rec.style.textAlign ="center";
//Rec.style.fontSize=Math.round(sqsize/1.8)+'px';
Rec.style.fontSize='20px';
//document.body.appendChild(Rec);
recordsB.appendChild(Rec);


   function PatList(){
Rec.innerHTML="PATTERNS:<br>";
for (var i=0;i<PatRec.length;i++){
Rec.innerHTML+=PatRec[i].record;
Rec.innerHTML+=" — ";
Rec.innerHTML+=PatRec[i].date;
Rec.innerHTML+="<br>";}}

   function FreList(){
Rec.innerHTML="FRENZY:<br>";
for (var z=0;z<FreRec.length;z++){
       console.log("Lll");
Rec.innerHTML+=FreRec[z].record;
Rec.innerHTML+=" — ";
Rec.innerHTML+=FreRec[z].date;
Rec.innerHTML+="<br>";
}}

button.addEventListener ("click", function() {
 horiAr = [];
 vertAr = [];
 hopX = [];
 hopY = [];
 
if (Patt == 0)
{
button.innerText = "Frenzy";
Patt = 1;
setCookie("Patt", "1");
canvas.removeEventListener("pointerdown", ClickTile);
canvas.addEventListener("pointerdown", ClickPattern);
RefrePP(1);
   // if (RecSh=="1"){
    PatList();

} else
{
button.innerText = "Patterns";
Patt = 0;
setCookie("Patt", "0");
canvas.removeEventListener("pointerdown", ClickPattern);
canvas.addEventListener("pointerdown", ClickTile);
Refresh(1);
PressKey.innerHTML="Press a key to start";
// if (RecSh=="1"){
FreList();
};
button.blur();
});

var PatAm=15;
var hopX=[],hopY=[];
var Pround=0;
var CPX,CPY;
var noErr=0;
function ClickPattern(event) {
if (event && event.button != null && event.button !== 0) return;
if (panelsOpen()) return;
if (countdownActive) return;
ensureAudio();
cx = event.clientX;
cy = event.clientY;
if (PatAm>0 && Errr==0 && timerWenP==true) {calculatePat();}
};
function calculatePat(){
CPX = Math.floor((cx-x0)/sqsize);
CPY = Math.floor((cy-w/4)/sqsize);
if (CPX < 0 || CPX > 3 || CPY < 0 || CPY > 3) return;
noErr=1;
for (var i = 0; i < Pround; i++) {
if (CPX==hopX[i] && CPY==hopY[i])
    {
    Pround--;
    hopX.splice(i, 1);
    hopY.splice(i, 1);
    DrawBlackPat();
    playHit(); // hitsound in puzzle/pattern mode
    runHits++;
    noErr=0;
    break;
    }
}
if (noErr==1) {
Errr=1;
runMisses++;
cXX = cx-x0;
cYY = cy-w/4;
CoX=CPX;
CoY=CPY;
DrawError();
wOLD = w;
cXXo =cXX;
cYYo =cYY;
}

if (Pround==0) {PatAm--;
                if (PatAm==0) {clearInterval(timerGP);PressKey.innerHTML="Press a key to start";
                              exactPat = performance.now()-exactPat;
                              Time.innerHTML=Math.round(exactPat)/1000;
                              FreP();
                              showRunSummary('pattern');
                              }else{
                Pround=4;drawPAT();PressKey.innerHTML=PatAm; }
               }
/*
 drawPAT();
 PatAm=15;
 PressKey.innerHTML=PatAm;
 Pround=4;*/
};

var FreTeP;
function FreP(){
today = new Date();
FreTeP = SubscriberP();
PatRec.push(FreTeP);
PatRec.sort((a, b) => (a.record > b.record) ? 1 : -1);
if (PatRec.length>10){PatRec.length=10;}
bake_cookie("recordsP", PatRec);
PatList();
}

function SubscriberP() {
  return {
    'record':   Math.round(exactPat)/1000,
    'date':    today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate()
  };
};


function RefrePP(p) {
 cancelCountdown();
 good = 1;
 Errr=0;
 resetRunStats();
 Score.innerHTML="&nbsp;";
 if (PatRec.length>0){
    Best.innerHTML="HI-SCORE<br>"+PatRec[0].record;}else{Best.innerHTML="HI-SCORE<br>-";}
 Time.innerHTML="0";
 clearInterval(timerGO);
 timerWent = true;
 var TimeL = 0;
 contextB.clearRect(0, 0, canvasB.width, canvasB.height);
 PressKey.innerHTML="Press a key to start";
 applyCursor(); // restore normal cursor after fail
    if (p==0){
 clearInterval(timerGP);
 timerWenP = false;
 TimeP = 0;
 drawPAT();
 PatAm=15;
 PressKey.innerHTML=PatAm;
 Pround=4;
 startCountdown(function() {
   resetRunStats();
   TimerPAT();
 });
    }

};
var TimeP,timerWenP;
var timerGP=null;
var exactPat;
function TimerPAT() {
exactPat = performance.now();
timerWenP = true;
timerGP = setInterval(function() {
//if (PatAm<=0) {clearInterval(timerGP);}
TimeP = Math.round((TimeP+0.1)*10)/10;
  //  console.log(TimeP);
Time.innerHTML=TimeP;
if (Errr == 1)
{clearInterval(timerGP);
PressKey.innerHTML="Press a key to start";Time.innerHTML+='('+PatAm+' left)';}
}, 100);
};
function drawPAT() {
 hopX[0] = Math.floor(Math.random() * (4 - 1 + 1));
 hopY[0] = Math.floor(Math.random() * (4 - 1 + 1));
 hopX[1] = hopX[0];
 hopY[1] = hopY[0];
 while (hopX[1] == hopX[0] && hopY[1] == hopY[0]) {
 hopX[1] = Math.floor(Math.random() * (4 - 1 + 1));
 hopY[1] = Math.floor(Math.random() * (4 - 1 + 1));
}
 hopX[2] = hopX[0];
 hopY[2] = hopY[0];
 while ((hopX[2] == hopX[0] && hopY[2] == hopY[0]) || (hopX[2] == hopX[1] && hopY[2] == hopY[1])) {
 hopX[2] = Math.floor(Math.random() * (4 - 1 + 1));
 hopY[2] = Math.floor(Math.random() * (4 - 1 + 1));
}
 hopX[3] = Math.floor(Math.random() * (4 - 1 + 1));
 hopY[3] = Math.floor(Math.random() * (4 - 1 + 1));
 while ((hopX[3] == hopX[0] && hopY[3] == hopY[0]) || (hopX[3] == hopX[1] && hopY[3] == hopY[1])
       || (hopX[3] == hopX[2] && hopY[3] == hopY[2])) {
 hopX[3] = Math.floor(Math.random() * (4 - 1 + 1));
 hopY[3] = Math.floor(Math.random() * (4 - 1 + 1));
}
 DrawBlackPat();
};
function DrawBlackPat() {
contextB.clearRect(0, 0, canvasB.width, canvasB.height);
contextB.beginPath();
for (var i = 0; i < hopX.length; i++) {
contextB.rect(hopX[i]*sqsize,hopY[i]*sqsize,sqsize,sqsize);
}
contextB.fillStyle = SETTINGS.tileColor || 'black';
contextB.closePath();
contextB.fill();
};



document.documentElement.style.overflow = 'hidden';
function Zoom() {
   var sqsizeD = Math.round(window.innerHeight*0.108);
   ZoomI = slider.value;
   sqsize = Math.round(sqsizeD*ZoomI/100);
   w = Math.round(sqsize*4);
   x0 = Math.round(window.innerWidth/2-w/2);
   //y0 = Math.round(sqsizeD*3-sqsize*(ZoomI-50)/160);
   x1 = w;
   y1 = w;
context.clearRect(0, 0, canvas.width, canvas.height);
CanvasLines();
CanvasBlack();
div.style.width=w;
div.style.height=Math.round(w*1.5);
div.style.left=x0+"px";
div.style.top=0+"px";
  Score.style.top=sqsize/4+"px";
  Score.style.fontSize=Math.round(sqsize/1.4)+'px';
Time.style.padding=sqsize/8+'px';
Time.style.top=0+"px";
Time.style.fontSize=Math.round(sqsize/1.8)+'px';
    if (Errr==1)
    {
cXX = cXXo/wOLD*w;
cYY = cYYo/wOLD*w;
DrawError();
    }
PressKey.style.top=w*1.07+"px";
PressKey.style.fontSize=Math.round(sqsize/3)+'px';
updateMeterPosition();
positionCountdownOverlay();
setCookie("Zoom", slider.value);
        console.log(getCookie("Zoom"));
console.log(x0);
   if (x0<200){
       slider.style.transform ="rotate(90deg)";
       slider.style.marginTop=100+"px";
       slider.style.marginLeft=-80+"px";
       button.style.transform ="rotate(90deg)";
       button.style.marginTop=200+"px";
       button.style.marginLeft=-80+"px";
       zom.style.marginLeft=-75+"px";
       button.style.paddingRight=20+"px";
    }
zom.innerHTML="-"+slider.value+"+";
Best.style.left= "75%";
Best.style.top=sqsize/3.6+"px";
Best.style.fontSize=Math.round(sqsize/5)+'px';

};

window.addEventListener('resize', Zoom);


canvas.style.position='absolute';
canvas.style.zIndex=10;
document.body.appendChild(canvas);
context = canvas.getContext('2d');
//canvas.style.pointerEvents='none'; //Make sure you can click 'through' the canvas
function CanvasLines() {
canvas.width = w;
canvas.height = w;
canvas.style.left=x0+"px";
canvas.style.top=w/4+"px";
context.lineWidth = 1;
context.strokeStyle = SETTINGS.lineColor || '#F0B3FF';
context.beginPath();
context.moveTo(0, 0);
context.lineTo(w, 0);
context.stroke();
context.moveTo(0, w/4-0.5);
context.lineTo(w, w/4-0.5);
context.stroke();
context.moveTo(0, w/2-0.5);
context.lineTo(w, w/2-0.5);
context.stroke();
context.moveTo(0, w/4*3-0.5);
context.lineTo(w, w/4*3-0.5);
context.stroke();
context.moveTo(0, w-0.5);
context.lineTo(w, w-0.5);
context.stroke();
context.moveTo(0+0.5, 0);
context.lineTo(0+0.5, w);
context.stroke();
context.moveTo(w/4-0.5,0);
context.lineTo(w/4-0.5,w);
context.stroke();
context.moveTo(w/2+0.5,0);
context.lineTo(w/2+0.5,w);
context.stroke();
context.moveTo(w/4*3-0.5,0);
context.lineTo(w/4*3-0.5,w);
context.stroke();
context.moveTo(w-0.5, 0);
context.lineTo(w-0.5,w);
context.stroke();
context.closePath();
}

CanvasLines();


//canvas.style.width=w+(0);
//canvas.style.height=w+(0);
canvasB.style.position='absolute';
canvasB.style.zIndex=9;
canvasB.style.pointerEvents='none'; //Make sure you can click 'through' the canvas
document.body.appendChild(canvasB); //Append canvas to body element
var contextB = canvasB.getContext('2d');
canvasB.width = w;
canvasB.height = w;
canvasB.style.left=x0+"px";
canvasB.style.top=w/4+"px";

function CanvasBlack() {
canvasB.width = w;
canvasB.height = w;
canvasB.style.left=x0+"px";
canvasB.style.top=w/4+"px";
contextB.clearRect(0, 0, canvasB.width, canvasB.height);
if (Patt==0){DrawBlack();}else{DrawBlackPat();}
}

var p=0;
function Refresh(p) {
 cancelCountdown();
 Bonus = 0;
 lastMultLevel = 1;
 resetRunStats();
 contextB.clearRect(0, 0, canvasB.width, canvasB.height);
 sc=0;
 good = 1;
 Errr=0;
 Score.innerHTML="0";
 Time.innerHTML="30";
 updateMultMeter();
 setInGameUI(true); // run starting — show meter, hide start text
 applyCursor(); // restore normal custom cursor size after a fail
 if (FreRec.length>0){
    Best.innerHTML="HI-SCORE<br>"+FreRec[0].record;}else{Best.innerHTML="HI-SCORE<br>-";}
 clearInterval(timerGP);
   if (p==0){
 clearInterval(timerGO);
 timerWent = false;
 TimeL = 30;
    //DrawSquares();
 horiAr[0] = Math.floor(Math.random() * (4 - 1 + 1));
 vertAr[0] = Math.floor(Math.random() * (4 - 1 + 1));
 horiAr[1] = horiAr[0];
 vertAr[1] = vertAr[0];
 while (horiAr[1] == horiAr[0] && vertAr[1] == vertAr[0]) {
 horiAr[1] = Math.floor(Math.random() * (4 - 1 + 1));
 vertAr[1] = Math.floor(Math.random() * (4 - 1 + 1));
}
 horiAr[2] = horiAr[0];
 vertAr[2] = vertAr[0];
 while ((horiAr[2] == horiAr[0] && vertAr[2] == vertAr[0]) || (horiAr[2] == horiAr[1] && vertAr[2] == vertAr[1])) {
 horiAr[2] = Math.floor(Math.random() * (4 - 1 + 1));
 vertAr[2] = Math.floor(Math.random() * (4 - 1 + 1));
}
DrawBlack();
PressKey.innerHTML="1";
 startCountdown(function() {
   resetRunStats();
   Timer();
 });
    }
};
function DrawBlack(){
contextB.clearRect(0, 0, canvasB.width, canvasB.height);
contextB.beginPath();
contextB.rect(horiAr[0]*sqsize,vertAr[0]*sqsize,sqsize,sqsize);
contextB.rect(horiAr[1]*sqsize,vertAr[1]*sqsize,sqsize,sqsize);
contextB.rect(horiAr[2]*sqsize,vertAr[2]*sqsize,sqsize,sqsize);
contextB.fillStyle = SETTINGS.tileColor || 'black';
contextB.closePath();
contextB.fill();
}

function flashHitCell(gx, gy) {
  try {
    contextB.save();
    contextB.fillStyle = 'rgba(255,255,255,0.35)';
    contextB.fillRect(gx*sqsize, gy*sqsize, sqsize, sqsize);
    contextB.restore();
    setTimeout(function() {
      if (Errr === 0 && Patt == 0) DrawBlack();
    }, 40);
  } catch(e) {}
}

function DrawSquares() {
//console.log(horiAr[0],vertAr[0],horiAr[1],vertAr[1],horiAr[2],vertAr[2],CoX,CoY);
    CoX = Math.floor((cx-x0)/sqsize);
    CoY = Math.floor((cy-w/4)/sqsize);
    // Click landed off the 4x4 board — ignore instead of counting a miss
    if (CoX < 0 || CoX > 3 || CoY < 0 || CoY > 3) {
      good = 1;
      return;
    }

for (var i = 0; i < horiAr.length; i++) {
    if (horiAr[i] == CoX && vertAr[i] == CoY)
    {
for (var y = 0; y < horiAr.length; y++) {
if (i != y) {OtherTiles[n] = y; n++;}
}
        n=0;
horT = horiAr[i];
verT = vertAr[i];
horiAr[i] = Math.floor(Math.random() * (4 - 1 + 1));
vertAr[i] = Math.floor(Math.random() * (4 - 1 + 1));
//console.log(OtherTiles);
while ((horiAr[i] == horiAr[OtherTiles[0]] && vertAr[i] == vertAr[OtherTiles[0]]) ||
       (horiAr[i] == horiAr[OtherTiles[1]] && vertAr[i] == vertAr[OtherTiles[1]]) ||
       (horiAr[i] == horT && vertAr[i] == verT)) {
horiAr[i] = Math.floor(Math.random() * (4 - 1 + 1));
vertAr[i] = Math.floor(Math.random() * (4 - 1 + 1));
}
contextB.clearRect(0, 0, canvasB.width, canvasB.height);
contextB.beginPath();
contextB.rect(horiAr[0]*sqsize,vertAr[0]*sqsize,sqsize,sqsize);
contextB.rect(horiAr[1]*sqsize,vertAr[1]*sqsize,sqsize,sqsize);
contextB.rect(horiAr[2]*sqsize,vertAr[2]*sqsize,sqsize,sqsize);
contextB.fillStyle = SETTINGS.tileColor || 'black';
contextB.closePath();
contextB.fill();
    //doit = 0;
       // console.log(Bonus,"1");
        if (Bonus<92){
        Bonus = Bonus+8;}
        else
        {Bonus=100;}
       // console.log(Bonus,"2");
        CalculateScore();
        playHit();          // <-- hitsound on successful click
        runHits++;
        flashHitCell(CoX, CoY);
        good=1;
        break;
}
}

      if (good==0) {
          Errr=1;
          runMisses++;
cXX = cx-x0;
cYY = cy-w/4;
DrawError();
wOLD = w;
cXXo =cXX;
cYYo =cYY;

      }
      good = 0;
}
var today;
var FreTem,temp;
function FreR(){
today = new Date();
var prevBest = (FreRec.length>0) ? FreRec[0].record : 0;
FreTem = Subscriber();
FreRec.push(FreTem);
FreRec.sort((a, b) => (a.record < b.record) ? 1 : -1);
if (FreRec.length>10){FreRec.length=10;}
bake_cookie("records", FreRec);
FreList();
if (Best && sc >= prevBest && sc > 0) {
  Best.innerHTML="HI-SCORE<br>"+sc;
  Best.style.transition = 'transform 0.15s ease';
  Best.style.transform = 'scale(1.25)';
  setTimeout(function(){ if (Best) Best.style.transform = 'scale(1)'; }, 180);
}
}


function Subscriber() {
  return {
    'record':   sc,
    'date':    today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate()
  };
};

function bake_cookie(name, value) {
  // Prefer localStorage so records survive app restarts (Electron + browser)
  try {
    if (name === 'records') localStorage.setItem('donttap_records', JSON.stringify(value));
    if (name === 'recordsP') localStorage.setItem('donttap_recordsP', JSON.stringify(value));
  } catch(e) {}
  // Keep cookie write as a secondary fallback for browser hosts
  try {
    var cookie = [name, '=', JSON.stringify(value), '; path=/;'].join('');
    document.cookie = cookie;
  } catch(e) {}
}

function read_cookie(name) {
  try {
    if (name === 'records') {
      var r = localStorage.getItem('donttap_records');
      if (r) return JSON.parse(r);
    }
    if (name === 'recordsP') {
      var p = localStorage.getItem('donttap_recordsP');
      if (p) return JSON.parse(p);
    }
  } catch(e) {}
  try {
    var result = document.cookie.match(new RegExp(name + '=([^;]+)'));
    result && (result = JSON.parse(result[1]));
    return result;
  } catch(e) { return null; }
}


function DrawError() {
contextB.beginPath();
    console.log(CoX,CoY);
contextB.rect(CoX*sqsize,CoY*sqsize,sqsize,sqsize);
contextB.fillStyle = SETTINGS.missColor || '#AF1800';
contextB.closePath();
contextB.fill();

if (!SETTINGS.useSystemCursor && cursorBaseImg) {
    // Stamp a smaller copy of the custom cursor at the miss point
    var failSize = Math.max(8, (SETTINGS.cursorSize | 0) - 8);
    var tinted = buildTintedCursorCanvas(failSize);
    if (tinted) {
        contextB.drawImage(tinted, cXX - failSize / 2, cYY - failSize / 2, failSize, failSize);
    }
} else {
    contextB.lineWidth = 1;
    contextB.strokeStyle = '#0011DA';
              contextB.beginPath();
    contextB.moveTo(cXX-5, cYY);
    contextB.lineTo(cXX+5, cYY);
    contextB.moveTo(cXX, cYY-5);
    contextB.lineTo(cXX, cYY+5);
              contextB.stroke();
}
applyFailCursor(); // shrink custom cursor by 5px on fail
          contextB.closePath();

};

canvas.addEventListener("pointerdown", ClickTile);

function ClickTile(event) {
    if (event && event.button != null && event.button !== 0) return;
    if (panelsOpen()) return;
    if (countdownActive) return;
    ensureAudio();          // unlock audio on first interaction
    cx = event.clientX;
    cy = event.clientY;
if (TimeL > 0 && Errr == 0)
{DrawSquares();}
    if (!timerWent)
    {Timer();}

};

//Score.innerHTML="&nbsp;"+"0";
Score.id = "score";
Score.innerHTML="0";
Score.style.position='center';
//Score.style.left=Math.round(w/2.23)+"px";
Score.style.top=sqsize/4+"px";
Score.style.zIndex=11;
Score.style.pointerEvents='none';
Score.style.color='purple';
Score.style.textAlign ="center";
Score.style.fontSize=Math.round(sqsize/1.4)+'px';
div.appendChild(Score);

var Best = document.createElement("div");
Best.id = "best";
Best.innerHTML="HI-SCORE<br>-";
Best.style.position='absolute';
Best.style.left= "75%";
//Score.style.left=Math.round(w/2.23)+"px";
Best.style.top=sqsize/3.6+"px";
Best.style.zIndex=11;
Best.style.marginTop="0px";
Best.style.pointerEvents='none';
Best.style.color='darkblue';
Best.style.textAlign ="center";
Best.style.fontSize=Math.round(sqsize/5)+'px';
div.appendChild(Best);


//Score.innerHTML="&nbsp;"+"0";
PressKey.id = "PressKey";
PressKey.innerHTML="Press a key to start";
PressKey.style.position='relative';
//Score.style.left=Math.round(w/2.23)+"px";
PressKey.style.top=w*1.07+"px";
PressKey.style.zIndex=11;
PressKey.style.pointerEvents='none';
//PressKey.style.color='blue';
PressKey.style.textAlign ="center";
PressKey.style.fontSize=Math.round(sqsize/3)+'px';
//PressKey.style.style.fontFamily = "Comic Sans MS, cursive, sans-serif";
div.appendChild(PressKey);

// --- Multiplier progress meter (under 4x4 grid; +25px down from prior, bar height +10px) ---
var meterWrap = document.createElement('div');
meterWrap.id = 'multMeterWrap';
// Grid bottom at 1.25*w; prior offset was -10, now +25 more down → +15 total
meterWrap.style.cssText = 'position:absolute;left:5%;width:90%;top:' + (Math.round(w * 1.25) + 15) + 'px;height:28px;background:#222;border:2px solid #555;border-radius:8px;overflow:hidden;z-index:12;box-sizing:border-box;display:none;';
function updateMeterPosition() {
  if (meterWrap) meterWrap.style.top = (Math.round(w * 1.25) + 15) + 'px';
}
var meterFill = document.createElement('div');
meterFill.id = 'multMeterFill';
meterFill.style.cssText = 'height:100%;width:0%;background:linear-gradient(90deg,#f460ff,#9e21a1);border-radius:6px;transition:width 0.08s linear;';
var meterLabel = document.createElement('div');
meterLabel.id = 'multMeterLabel';
meterLabel.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;pointer-events:none;text-shadow:0 1px 2px #000;';
meterLabel.textContent = 'MULT x1';
meterWrap.appendChild(meterFill);
meterWrap.appendChild(meterLabel);
div.appendChild(meterWrap);

function setInGameUI(inGame) {
  // During a run:
  //   - meter ON  → show meter, hide PressKey
  //   - meter OFF → hide meter, show PressKey with multiplier (1–5)
  // Between games: hide meter, show "Press a key to start"
  if (inGame) {
    if (SETTINGS.showMeter) {
      if (meterWrap) meterWrap.style.display = 'block';
      if (PressKey) PressKey.style.display = 'none';
    } else {
      if (meterWrap) meterWrap.style.display = 'none';
      if (PressKey) {
        PressKey.style.display = 'block';
        // show current multiplier number (1–5)
        PressKey.innerHTML = String(Math.max(1, Math.ceil((Bonus || 0) / 20) || 1));
      }
    }
  } else {
    if (meterWrap) meterWrap.style.display = 'none';
    if (PressKey) {
      PressKey.style.display = 'block';
      PressKey.innerHTML = 'Press a key to start';
    }
  }
}

function updateMultMeter() {
  if (!meterFill) return;
  var mult = Math.max(1, Math.ceil((Bonus || 0) / 20));
  if (mult > 5) mult = 5;
  // Only show the current multiplier number
  meterLabel.textContent = String(mult);

  if (SETTINGS.meterMode === 'overall') {
    // Full progress from 0 → 100 bonus (5x max)
    var overallPct = Math.min(100, Math.max(0, (Bonus || 0) / 100 * 100));
    meterFill.style.width = overallPct + '%';
    return;
  }

  // Segment mode: progress within current multiplier band
  if (Bonus >= 100) {
    meterFill.style.width = '100%';
    return;
  }
  var inBand = Bonus % 20;
  var pct = Math.min(100, (inBand / 20) * 100);
  if (Bonus > 0 && inBand === 0) pct = 100;
  meterFill.style.width = pct + '%';
}

//Score.innerHTML="&nbsp;"+"0";
Time.id = "time";
Time.innerHTML="30";
Time.style.position='absolute';
Time.style.padding=sqsize/8+'px';
//Score.style.left=Math.round(w/2.23)+"px";
Time.style.top=0+"px";
Time.style.zIndex=11;
Time.style.pointerEvents='none';
Time.style.color='black';
Time.style.textAlign ="left";
Time.style.fontSize=Math.round(sqsize/1.8)+'px';
div.appendChild(Time);

function CalculateScore() {
B5=Math.ceil(Bonus/20);
if (B5 < 1) B5 = 1;
sc=sc+B5;
Score.innerHTML=sc;
PressKey.innerHTML=B5;
if (B5 > lastMultLevel) {
  playMultJingle();
  lastMultLevel = B5; // only climb — drop + climb again will not replay
}
if (B5 > runMaxMult) runMaxMult = B5;
updateMultMeter();
};

     function Timer() {
timerWent=true;
timerGO = setInterval(function() {
TimeL = (TimeL-0.1).toFixed(1);
if (Bonus>3){
    Bonus=Math.round((Bonus-3)*10)/10;}else{Bonus=0.1;}
    PressKey.innerHTML=Math.ceil(Bonus/20);
    updateMultMeter();
    //console.log(Bonus,"3");
    //console.log(Bonus);
Time.innerHTML=TimeL;
if (TimeL <= 0)
{clearInterval(timerGO);Time.innerHTML="0";PressKey.innerHTML="Press a key to start";FreR(); updateMultMeter(); setInGameUI(false); showRunSummary('frenzy');}
    //console.log(Errr,"Errr");
if (Errr == 1)
{clearInterval(timerGO);
FreR();
//console.log(FreRec);
PressKey.innerHTML="Press a key to start";
updateMultMeter();
setInGameUI(false);
showRunSummary('frenzy');}
}, 100);
     }



document.addEventListener("keydown", KeyPress);
function KeyPress(event) {
key = event.key;
if (key === 'Escape') { closePanels(); return; }
if (panelsOpen()) return;
if (event.repeat) return;
if (event.ctrlKey || event.altKey || event.metaKey) return;
if (!SETTINGS.startOnAnyKey && key !== ' ' && key !== 'Spacebar' && key !== 'Enter') return;
if (key === 'Tab') return;
ensureAudio();              // unlock audio on first key press
if (Patt == 0){
Refresh(0);}else{RefrePP(0);}
};

document.addEventListener('contextmenu', function(e) {
  if (e.target && e.target.tagName === 'CANVAS') e.preventDefault();
});


if (PaC != "") {Patt=Math.abs(Number(PaC)-1);button.click();}else{Patt=0;}

        }, 50);