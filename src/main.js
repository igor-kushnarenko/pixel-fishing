// Pocket Fishing — Vite + Three.js. Style inspired by Pixel Plays (MIT, Amir Mushich): https://github.com/amirmushichge/pixel-plays
import * as THREE from 'three';

const FISH_TYPES = [
  { name: 'Карась', color: '#d2aa99', size: 0.8, rarity: 45, points: 10 },
  { name: 'Окунь', color: '#6daa2c', size: 1, rarity: 28, points: 20 },
  { name: 'Форель', color: '#6dc2ca', size: 1.2, rarity: 16, points: 40 },
  { name: 'Щука', color: '#346524', size: 1.5, rarity: 8, points: 80 },
  { name: 'Золотая рыбка', color: '#dad45e', size: 0.9, rarity: 3, points: 200 }
];

function chooseFish() {
  let roll = Math.random() * FISH_TYPES.reduce((sum, type) => sum + type.rarity, 0);
  for (const type of FISH_TYPES) {
    roll -= type.rarity;
    if (roll < 0) return type;
  }
  return FISH_TYPES[FISH_TYPES.length - 1];
}

const W = 160, H = 120;
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(1);
document.body.appendChild(renderer.domElement);
const rt = new THREE.WebGLRenderTarget(W, H, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthTexture: new THREE.DepthTexture(W, H) });

const scene = new THREE.Scene();
scene.background = new THREE.Color('#ffffff');
const cam = new THREE.OrthographicCamera(-8, 8, 6, -6, 0.1, 100);
cam.position.set(10, 10, 10); cam.lookAt(0, 0, 0);
scene.add(new THREE.HemisphereLight('#fff6d0', '#5a4a8a', 1.2));
const sun = new THREE.DirectionalLight('#ffffff', 1.5); sun.position.set(-5, 10, 3); scene.add(sun);

const mat = c => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
const box = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); scene.add(m); return m; };

// water + pier + character
const water = box(14, 0.4, 14, '#3a7bd5', 0, -0.4, 0);
for (let i = 0; i < 5; i++) box(1.6, 0.2, 0.9, i % 2 ? '#a0703c' : '#8a5a2b', -4, 0.1, -4 + i);
box(0.3, 1.2, 0.3, '#5a3a1b', -4.7, -0.3, -4); box(0.3, 1.2, 0.3, '#5a3a1b', -3.3, -0.3, 0);
const hero = new THREE.Group(); scene.add(hero); hero.position.set(-4, 0.2, 0);
const part = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); hero.add(m); return m; };
part(0.5, 0.6, 0.4, '#d04040', 0, 0.6, 0); part(0.4, 0.4, 0.4, '#f0c090', 0, 1.1, 0); part(0.5, 0.3, 0.5, '#e8d040', 0, 1.35, 0);
part(0.5, 0.3, 0.3, '#303060', 0, 0.15, 0);
const rod = part(0.06, 0.06, 2.2, '#6a4a2a', 0.2, 0.9, 1.0); rod.rotation.x = -0.4;
const bob = box(0.25, 0.25, 0.25, '#ff3030', 0, -100, 0);
const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: '#202020' })); scene.add(line);
const fish = box(0.6, 0.3, 0.2, '#e08030', 0, -100, 0);

// post: palette quantize + outline
const PAL = ['#140c1c','#442434','#30346d','#4e4a4e','#854c30','#346524','#d04648','#757161','#597dce','#d27d2c','#8595a1','#6daa2c','#d2aa99','#6dc2ca','#dad45e','#deeed6']
  .map(h => new THREE.Color(h));
const post = new THREE.ShaderMaterial({
  uniforms: { tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, pal: { value: PAL.map(c => new THREE.Vector3(c.r, c.g, c.b)) }, px: { value: new THREE.Vector2(1 / W, 1 / H) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
  fragmentShader: `uniform sampler2D tColor,tDepth; uniform vec3 pal[16]; uniform vec2 px; varying vec2 vUv;
  void main(){ vec3 c=texture2D(tColor,vUv).rgb; float d=texture2D(tDepth,vUv).r;
    float e=0.; e=max(e,texture2D(tDepth,vUv+vec2(px.x,0)).r-d); e=max(e,texture2D(tDepth,vUv+vec2(0,px.y)).r-d);
    e=max(e,texture2D(tDepth,vUv-vec2(px.x,0)).r-d); e=max(e,texture2D(tDepth,vUv-vec2(0,px.y)).r-d);
    if(e>0.01) c*=0.35;
    vec3 best=pal[0]; float bd=1e9; for(int i=0;i<16;i++){ vec3 q=c-pal[i]; float k=dot(q,q); if(k<bd){bd=k;best=pal[i];} }
    if(d>0.9999 && e<=0.01) best=vec3(1.); gl_FragColor=vec4(best,1.); }`,
  depthTest: false, depthWrite: false
});
const postScene = new THREE.Scene(); postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));
const postCam = new THREE.Camera();

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  const a = innerWidth / innerHeight, h = 6; cam.left = -h * a; cam.right = h * a; cam.top = h; cam.bottom = -h; cam.updateProjectionMatrix();
  rt.setSize(Math.round(H * a), H); post.uniforms.px.value.set(1 / Math.round(H * a), 1 / H);
}
addEventListener('resize', resize); resize();

// game loop: idle -> cast -> wait -> bite -> (hook|miss)
const hud = document.getElementById('hud');
let state = 'idle', t = 0, biteAt = 0, score = 0, activeFish = null, lastCatch = null, target = new THREE.Vector3();
const say = s => hud.textContent = `Очки: ${score}${lastCatch ? ` · ${lastCatch.name}` : ''} — ${s}`;
function tap(e) {
  e.preventDefault();
  if (state === 'idle') { state = 'cast'; t = 0; target.set(-4 + 2 + Math.random() * 3, -0.15, -1 + Math.random() * 4); say('ждём поклёвку...'); }
  else if (state === 'wait' || state === 'cast') { state = 'idle'; bob.position.y = -100; say('рано! тапни, чтобы закинуть'); }
  else if (state === 'bite') {
    state = 'caught'; t = 0; lastCatch = activeFish; score += activeFish.points;
    fish.material.color.set(activeFish.color); fish.scale.setScalar(activeFish.size);
    say(`поймал: ${activeFish.name}! +${activeFish.points} 🎣`);
  }
}
renderer.domElement.addEventListener('pointerdown', tap);
say('тапни, чтобы закинуть');

const clock = new THREE.Clock();
const tip = new THREE.Vector3();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1); t += dt;
  rod.getWorldPosition(tip); tip.z += 1.0; tip.y += 0.45;
  if (state === 'cast') { const k = Math.min(t / 0.6, 1); bob.position.lerpVectors(tip, target, k); bob.position.y += Math.sin(k * Math.PI) * 1.5;
    if (k >= 1) { state = 'wait'; t = 0; biteAt = 1.5 + Math.random() * 4; } }
  else if (state === 'wait') { bob.position.y = -0.15 + Math.sin(t * 3) * 0.03; if (t > biteAt) { activeFish = chooseFish(); state = 'bite'; t = 0; say('КЛЮЁТ! тапай!'); } }
  else if (state === 'bite') { bob.position.y = -0.3 + Math.sin(t * 30) * 0.1; if (t > 0.9) { state = 'idle'; bob.position.y = -100; say('сорвалась. тапни, чтобы закинуть'); } }
  else if (state === 'caught') { fish.position.lerpVectors(target, tip, Math.min(t, 1)); fish.position.y += Math.sin(Math.min(t, 1) * Math.PI); fish.rotation.z = t * 10; bob.position.copy(fish.position);
    if (t > 1.2) { state = 'idle'; fish.position.y = -100; bob.position.y = -100; say('тапни, чтобы закинуть'); } }
  line.visible = bob.position.y > -50;
  lineGeo.setFromPoints([tip, bob.position]);
  water.material.color.setHSL(0.6, 0.6, 0.5 + Math.sin(performance.now() / 800) * 0.03);
  renderer.setRenderTarget(rt); renderer.render(scene, cam);
  renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  requestAnimationFrame(frame);
}
frame();
