import * as THREE from 'three';
import { MAP_WIDTH as W, MAP_HEIGHT as H, BOATS, WATER_POLYGONS, SHORE_PATHS, FOREGROUND_PIER, FISHERMAN, ROD_GRIP, ROD_TIP } from './harbor-map.js';

const vertex = 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const tint = `vec3 evening(vec3 c) {
  float ink=1.-smoothstep(.90,.99,min(c.r,min(c.g,c.b)));
  return mix(c,c*vec3(.35,.43,.65),ink*(1.-uDaylight)*.78);
}`;
const backgroundFragment = `uniform sampler2D uMap,uMask; uniform float uDaylight,uMasked; varying vec2 vUv;
${tint}
void main(){vec4 c=texture2D(uMap,vUv);gl_FragColor=vec4(evening(c.rgb),mix(1.,texture2D(uMask,vUv).r,uMasked));
#include <colorspace_fragment>
}`;
const waterFragment = `uniform sampler2D uMap,uMask; uniform float uTime,uMotion,uDaylight; varying vec2 vUv;
${tint}
float wet(vec3 c){
  return smoothstep(.02,.12,c.g-c.r)*smoothstep(.015,.09,c.b-c.r);
}
void main(){
  vec2 texel=vec2(1./1448.,1./1086.);
  vec2 p=vUv*vec2(1448.,1086.);
  vec4 original=texture2D(uMap,vUv);vec2 mask=texture2D(uMask,vUv).rg;
  // Include narrow foam/reflections surrounded by teal, while excluding timber and rock.
  float neighbors=wet(texture2D(uMap,vUv+vec2(3.,0.)*texel).rgb)
    +wet(texture2D(uMap,vUv-vec2(3.,0.)*texel).rgb)
    +wet(texture2D(uMap,vUv+vec2(0.,3.)*texel).rgb)
    +wet(texture2D(uMap,vUv-vec2(0.,3.)*texel).rgb);
  float alpha=mask.r*max(wet(original.rgb),smoothstep(1.8,3.5,neighbors));
  if(alpha<.01) discard;
  float t=uTime;
  vec2 flow=vec2(
    sin(p.y*.075-t*1.45)*3.4+sin(p.x*.034+t*.8)*1.3,
    cos(p.x*.061-t*1.1)*1.8+sin(p.y*.11+t*.75)*.7
  )*texel*uMotion;
  vec2 movingUv=vUv+flow*alpha;
  vec3 displaced=texture2D(uMap,movingUv).rgb;
  // A displaced sample cannot pull a dock or rock into the water.
  float safe=texture2D(uMask,movingUv).r*wet(displaced);
  vec3 c=mix(original.rgb,displaced,safe);
  // Broken, travelling wave crests remain legible when the full map is fitted on screen.
  float phase=p.y*.24+p.x*.022+sin(p.x*.032+t*.4)*1.4-t*1.9;
  float crests=pow(max(0.,sin(phase)),14.);
  float breaks=smoothstep(.18,.86,.5+.5*sin(p.x*.115+sin(p.y*.055)+t*.6));
  float swell=sin(p.y*.061-p.x*.017-t*.95);
  c*=1.+swell*.065*uMotion;
  c=mix(c,vec3(.32,.72,.67),crests*breaks*.30*uMotion);
  float sparkle=pow(max(0.,sin(p.x*.27+sin(p.y*.09)+t*.9)),20.)
    *pow(max(0.,sin(p.y*.36-t*2.6)),14.);
  c=mix(c,vec3(.78,.96,.86),sparkle*.38*uMotion);
  // Green mask channel follows the actual shoreline, not the perimeter of a rectangle.
  float shorePhase=mask.g*15.-t*2.2+sin(p.x*.055+p.y*.032)*.65;
  float foam=pow(max(0.,sin(shorePhase)),9.)*smoothstep(.06,.35,mask.g);
  float lace=.55+.45*sin(p.x*.2-p.y*.11+t*.7);
  c=mix(c,vec3(.72,.94,.85),foam*lace*.48*uMotion);
  gl_FragColor=vec4(evening(c),alpha);
  #include <colorspace_fragment>
}`;

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d'));
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function maskTexture(polygons) {
  return canvasTexture(W, H, ctx => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff';
    for (const polygon of polygons) {
      ctx.beginPath(); polygon.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill();
    }
  });
}
function waterMaskTexture() {
  return canvasTexture(W, H, ctx => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    // R = water area, G = soft proximity to beach/breakwater.
    ctx.fillStyle = '#f00';
    for (const polygon of WATER_POLYGONS) {
      ctx.beginPath(); polygon.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 24; ctx.lineCap = ctx.lineJoin = 'round'; ctx.filter = 'blur(9px)';
    for (const path of SHORE_PATHS) {
      ctx.beginPath(); path.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
    }
  });
}
function position(object, x, y, z = object.position.z) { object.position.set(x, H - y, z); }

export class HarborView {
  zoom = 1; pan = new THREE.Vector2(); time = 0; motion = true;
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.setClearColor('#ffffff');
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(0, W, H, 0, 0.1, 100);
    this.camera.position.z = 50;
    this.resize();
  }

  async load() {
    const loader = new THREE.TextureLoader();
    const [map, atlas] = await Promise.all([
      loader.loadAsync(`${import.meta.env.BASE_URL}art/harbor.png`),
      loader.loadAsync(`${import.meta.env.BASE_URL}art/harbor-sprites.png`)
    ]);
    for (const texture of [map, atlas]) { texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy()); }
    this.atlas = atlas;
    this.dayMaterials = []; this.tintMaterials = [];
    const waterMask = waterMaskTexture(), pierMask = maskTexture([FOREGROUND_PIER]);
    const material = (fragmentShader, mask, masked = 0) => {
      const result = new THREE.ShaderMaterial({
        vertexShader: vertex, fragmentShader, transparent: true, depthTest: false, depthWrite: false,
        uniforms: { uMap: { value: map }, uMask: { value: mask }, uMasked: { value: masked }, uDaylight: { value: 1 }, uTime: { value: 0 }, uMotion: { value: 1 } }
      });
      this.dayMaterials.push(result); return result;
    };
    this.plane(W, H, material(backgroundFragment, waterMask), W / 2, H / 2, 0);
    this.water = material(waterFragment, waterMask);
    this.plane(W, H, this.water, W / 2, H / 2, 1);
    this.boats = BOATS.map(boat => ({ mesh: this.sprite(boat.crop, boat.width, boat.x, boat.y, 2), ...boat }));
    this.plane(W, H, material(backgroundFragment, pierMask, 1), W / 2, H / 2, 3);
    const fishermanCrop = [704, 598, 228, 390], fishermanHeight = 84;
    this.sprite(fishermanCrop, fishermanHeight * fishermanCrop[2] / fishermanCrop[3], FISHERMAN.x, FISHERMAN.y - fishermanHeight / 2, 4);
    this.makeFishing(); this.makeLights(); this.makeSmoke();
  }

  plane(width, height, material, x, y, order) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.renderOrder = order; position(mesh, x, y, order);
    this.scene.add(mesh); return mesh;
  }

  sprite(crop, width, x, y, order) {
    const texture = this.atlas.clone(), [sx, sy, sw, sh] = crop;
    texture.repeat.set(sw / this.atlas.image.width, sh / this.atlas.image.height);
    texture.offset.set(sx / this.atlas.image.width, 1 - (sy + sh) / this.atlas.image.height);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false, toneMapped: false });
    this.tintMaterials.push(material);
    return this.plane(width, width * sh / sw, material, x, y, order);
  }

  makeFishing() {
    const buoyTexture = canvasTexture(48, 80, ctx => {
      ctx.fillStyle = '#274540'; ctx.fillRect(22, 3, 4, 65);
      ctx.fillStyle = '#fff8da'; ctx.beginPath(); ctx.ellipse(24, 40, 13, 23, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ce4e37'; ctx.beginPath(); ctx.ellipse(24, 29, 12, 13, 0, Math.PI, Math.PI * 2); ctx.lineTo(36, 40); ctx.lineTo(12, 40); ctx.fill();
    });
    const basic = texture => new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false, toneMapped: false });
    this.bob = this.plane(12, 20, basic(buoyTexture), 0, 0, 9); this.bob.visible = false;
    const mark = canvasTexture(64, 96, ctx => {
      ctx.font = 'bold 88px Georgia'; ctx.textAlign = 'center'; ctx.lineWidth = 7;
      ctx.strokeStyle = '#3e3727'; ctx.strokeText('!', 32, 78); ctx.fillStyle = '#fff3a2'; ctx.fillText('!', 32, 78);
    });
    this.mark = this.plane(20, 30, basic(mark), 0, 0, 10); this.mark.visible = false;
    const fishTexture = canvasTexture(100, 50, ctx => {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(12, 25); ctx.lineTo(0, 6); ctx.lineTo(0, 44); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.ellipse(50, 25, 38, 18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#263b3d'; ctx.beginPath(); ctx.arc(73, 20, 3, 0, Math.PI * 2); ctx.fill();
    });
    this.fish = this.plane(32, 16, basic(fishTexture), 0, 0, 10); this.fish.visible = false;
    this.line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#3d514e', transparent: true, opacity: 0.8, depthTest: false }));
    this.line.renderOrder = 8; this.line.position.z = 8; this.scene.add(this.line);
    const rod = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(ROD_GRIP.x, H - ROD_GRIP.y, 5), new THREE.Vector3(ROD_TIP.x, H - ROD_TIP.y, 5)
    ]), new THREE.LineBasicMaterial({ color: '#725139', depthTest: false }));
    rod.renderOrder = 5; this.scene.add(rod);
    this.ringMaterial = new THREE.ShaderMaterial({
      vertexShader: vertex, transparent: true, depthTest: false, depthWrite: false,
      uniforms: { uRemaining: { value: 1 } },
      fragmentShader: `varying vec2 vUv; uniform float uRemaining;
      void main(){vec2 p=vUv-.5;float r=length(p);float ring=smoothstep(.40,.42,r)*(1.-smoothstep(.46,.48,r));
      float angle=mod(atan(p.y,p.x)+6.283185-1.570796,6.283185)/6.283185;
      gl_FragColor=vec4(vec3(1.,.81,.32),ring*mix(.16,1.,step(angle,uRemaining)));}`
    });
    this.ring = this.plane(38, 38, this.ringMaterial, 0, 0, 9); this.ring.visible = false;
    this.rippleMaterial = new THREE.ShaderMaterial({
      vertexShader: vertex, transparent: true, depthTest: false, depthWrite: false,
      uniforms: { uPhase: { value: 0 }, uOpacity: { value: 0.4 } },
      fragmentShader: `varying vec2 vUv;uniform float uPhase,uOpacity;
      void main(){float r=length((vUv-.5)*vec2(1.,1.8));float radius=.08+uPhase*.38;
      float a=(1.-smoothstep(.012,.035,abs(r-radius)))*(1.-uPhase)*uOpacity;gl_FragColor=vec4(.77,.95,.91,a);}`
    });
    this.ripple = this.plane(80, 80, this.rippleMaterial, 0, 0, 8); this.ripple.visible = false;
  }

  makeLights() {
    const glowTexture = canvasTexture(128, 128, ctx => {
      const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, '#ffeabb'); gradient.addColorStop(0.2, '#ffd16eaa'); gradient.addColorStop(1, '#ffac3000');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
    });
    this.glows = [[461,123],[585,151],[770,104],[817,112],[891,117],[700,151],[469,249],[391,375],[453,458],[774,369],[924,397],[1190,486],[1323,593],[687,630],[229,518],[1251,197]].map(([x,y], index) => {
      const material = new THREE.MeshBasicMaterial({ map: glowTexture, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, opacity: 0 });
      return { mesh: this.plane(index === 15 ? 105 : 54, index === 15 ? 105 : 54, material, x, y, 7), phase: index };
    });
    const beamTexture = canvasTexture(512, 128, ctx => {
      const gradient = ctx.createLinearGradient(0, 64, 512, 64);
      gradient.addColorStop(0, '#ffe4a5bb'); gradient.addColorStop(1, '#ffe4a500');
      ctx.fillStyle = gradient; ctx.beginPath(); ctx.moveTo(0, 64); ctx.lineTo(512, 0); ctx.lineTo(512, 128); ctx.fill();
    });
    this.beam = new THREE.Group(); position(this.beam, 1251, 197, 6); this.scene.add(this.beam);
    this.beamMaterial = new THREE.MeshBasicMaterial({ map: beamTexture, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(480, 120), this.beamMaterial); mesh.position.x = 240; mesh.renderOrder = 6; this.beam.add(mesh);
  }

  makeSmoke() {
    this.smoke = [];
    for (const chimney of [{ x: 518, y: 47 }, { x: 260, y: 326 }]) {
      for (let i = 0; i < 3; i++) {
        const mesh = this.sprite([1155, 650, 330, 374], 42, chimney.x, chimney.y, 6);
        this.smoke.push({ mesh, chimney, phase: i / 3 });
      }
    }
  }

  resize() {
    this.width = this.canvas.clientWidth || innerWidth; this.height = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(this.width, this.height, false);
    this.baseScale = Math.max(0.01, Math.min((this.width - 24) / W, Math.max(140, this.height - 154) / H));
    this.updateCamera();
  }
  updateCamera() {
    const width = this.width / this.baseScale / this.zoom, height = this.height / this.baseScale / this.zoom;
    const cx = W / 2 + this.pan.x, cy = H / 2 + this.pan.y;
    this.camera.left = cx - width / 2; this.camera.right = cx + width / 2;
    this.camera.top = cy + height / 2; this.camera.bottom = cy - height / 2;
    this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
  }
  screenToMap(x, y) {
    const world = new THREE.Vector3(x / this.width * 2 - 1, 1 - y / this.height * 2, 0).unproject(this.camera);
    return { x: world.x, y: H - world.y };
  }
  zoomAt(factor, x = this.width / 2, y = this.height / 2) {
    const before = this.screenToMap(x, y);
    this.zoom = THREE.MathUtils.clamp(this.zoom * factor, 1, 3.5); this.updateCamera();
    const after = this.screenToMap(x, y);
    this.pan.x += before.x - after.x; this.pan.y -= before.y - after.y; this.clampPan();
  }
  drag(dx, dy) {
    this.pan.x -= dx / this.baseScale / this.zoom; this.pan.y += dy / this.baseScale / this.zoom; this.clampPan();
  }
  clampPan() {
    this.pan.x = THREE.MathUtils.clamp(this.pan.x, -W * 0.45, W * 0.45);
    this.pan.y = THREE.MathUtils.clamp(this.pan.y, -H * 0.45, H * 0.45);
    if (this.zoom === 1) this.pan.set(0, 0);
    this.updateCamera();
  }
  fit() { this.zoom = 1; this.pan.set(0, 0); this.updateCamera(); }

  render(game, dt, reducedMotion) {
    this.motion = !reducedMotion; if (this.motion && !game.paused) this.time += dt;
    const t = this.time, daylight = game.daylight;
    for (const material of this.dayMaterials) material.uniforms.uDaylight.value = daylight;
    this.water.uniforms.uTime.value = t; this.water.uniforms.uMotion.value = this.motion ? 1 : 0;
    for (const material of this.tintMaterials) material.color.setRGB(0.55 + 0.45 * daylight, 0.62 + 0.38 * daylight, 0.8 + 0.2 * daylight);
    for (const boat of this.boats) {
      position(boat.mesh, boat.x + (this.motion ? Math.sin(t * 0.65 + boat.phase) * 1.2 : 0), boat.y + (this.motion ? Math.sin(t * 1.15 + boat.phase) * 1.6 : 0));
      boat.mesh.rotation.z = this.motion ? Math.sin(t * 0.8 + boat.phase) * 0.006 : 0;
    }
    for (const { mesh, chimney, phase } of this.smoke) {
      const p = this.motion ? (t * 0.085 + phase) % 1 : 0.4;
      position(mesh, chimney.x + Math.sin(p * 3) * 12, chimney.y - 12 - p * 65);
      mesh.scale.setScalar(0.4 + p * 0.8);
      mesh.material.opacity = (!this.motion && phase > 0) ? 0 : Math.sin(p * Math.PI) * 0.55;
    }
    for (const { mesh, phase } of this.glows) mesh.material.opacity = (0.12 + (1 - daylight) * 0.65) * (this.motion ? 0.95 + Math.sin(t * 1.8 + phase) * 0.05 : 1);
    this.beam.rotation.z = this.motion ? -t * 0.22 : -0.8;
    this.beamMaterial.opacity = 0.08 + (1 - daylight) * 0.3;
    this.drawFishing(game);
    this.renderer.render(this.scene, this.camera);
  }

  drawFishing(game) {
    const visible = game.state !== 'idle', target = game.target;
    const cueScale = Math.max(1, 0.55 / (this.baseScale * this.zoom));
    for (const cue of [this.bob, this.mark, this.ring]) cue.scale.setScalar(cueScale);
    this.bob.visible = visible && game.state !== 'caught'; this.line.visible = visible;
    this.mark.visible = this.ring.visible = game.state === 'bite'; this.fish.visible = game.state === 'caught';
    this.ripple.visible = game.state === 'wait' || game.state === 'bite';
    if (!visible || !target) return;
    let x = target.x, y = target.y;
    if (game.state === 'cast') {
      const k = Math.min(game.stateTime / 0.6, 1);
      x = THREE.MathUtils.lerp(ROD_TIP.x, target.x, k); y = THREE.MathUtils.lerp(ROD_TIP.y, target.y, k) - Math.sin(k * Math.PI) * 65;
    } else if (game.state === 'caught') {
      const k = Math.min(game.stateTime / 1.1, 1);
      x = THREE.MathUtils.lerp(target.x, ROD_GRIP.x, k); y = THREE.MathUtils.lerp(target.y, ROD_GRIP.y, k) - Math.sin(k * Math.PI) * 72;
      position(this.fish, x, y, 10); this.fish.material.color.set(game.lastCatch.color);
      this.fish.scale.setScalar(game.lastCatch.size * Math.max(1, 0.45 / (this.baseScale * this.zoom)));
      this.fish.rotation.z = this.motion ? Math.sin(game.stateTime * 12) * 0.25 : 0;
    } else if (this.motion) y += Math.sin(this.time * (game.state === 'bite' ? 18 : 2)) * (game.state === 'bite' ? 2 : 0.8);
    position(this.bob, x, y - 8, 9); position(this.mark, x, y - 18 - 30 * cueScale, 10); position(this.ring, x, y - 7, 9);
    this.ringMaterial.uniforms.uRemaining.value = game.biteRemaining;
    position(this.ripple, target.x, target.y, 8);
    this.rippleMaterial.uniforms.uPhase.value = this.motion ? (game.stateTime % 1.8) / 1.8 : 0.5;
    const points = [];
    for (let i = 0; i <= 20; i++) {
      const k = i / 20;
      points.push(new THREE.Vector3(THREE.MathUtils.lerp(ROD_TIP.x, x, k), H - THREE.MathUtils.lerp(ROD_TIP.y, y - 12, k) - Math.sin(k * Math.PI) * 8, 0));
    }
    this.line.geometry.setFromPoints(points);
  }
}
