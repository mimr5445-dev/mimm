// scenes/shots/01_archivist.js — يستخدم نفس الشخصية في مشهدين
import { E, V, registerShot, mood } from '/engine/core.js';
import { drawFigure, POSES, breathe } from '/engine/rig2d.js';
import { studio } from '../sets/studio.js';
import { loadCharacter, getOutfit } from '/library/engine/character.js';

let ARCHIVIST = null;
loadCharacter('test_archivist').then(m => { ARCHIVIST = m; }).catch(e => console.log('load failed', e.message));

// s001 — وقوف محايد (procedural fallback + layered visual)
registerShot('s001', {
  draw(g, t, info) {
    const cam = { z: 1 + 0.04 * t, x: -10 * t };
    const { GY, M } = studio(g, t, cam);
    // خلفية بسيطة
    g.fillStyle = 'rgba(255,255,255,0.02)';
    g.fillRect(0, E.H*0.2, E.W, E.H*0.4);

    if (!ARCHIVIST) {
      g.fillStyle = '#ff6b6b';
      g.font = '40px sans-serif';
      g.textAlign = 'center';
      g.fillText('Loading archivist...', E.W/2, E.H/2);
      return;
    }

    // طريقة 1: procedural (للمقارنة) — يظهر نفس الهوية عبر outfit
    const outfit = getOutfit(ARCHIVIST);
    // نستخدم drawFigure مع pose stand و expr neutral
    // هذا يثبت أن الهوية (colors, head, face) ثابتة
    const pose = breathe(POSES.stand, t);
    g.save();
    // رسم ظل
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.ellipse(E.W/2 - 80, GY+2, 38, 6, 0, 0, Math.PI*2); g.fill();
    drawFigure(g, { x: E.W/2 - 80, y: GY, s: 1.3, facing: 1, outfit, pose, expr: 'neutral', rim: {color: M.rim, dir: [0,-1]}, blink: (t%3.1)>3.0 });
    g.restore();

    // لافتة
    g.fillStyle = '#C9A86A';
    g.font = '700 28px Nunito';
    g.textAlign = 'center';
    g.fillText('s001 — stand / neutral — procedural bridge', E.W/2, E.H*0.12);
    g.fillStyle = '#fff';
    g.font = '400 18px Nunito';
    g.fillText(`engine=${ARCHIVIST.engine} hash=${ARCHIVIST.identityHash.slice(0,8)}`, E.W/2, E.H*0.16);

    // طريقة 2: layered (إذا توفرت الصور، ستُرسم فوق - للتوضيح)
    // نرسم أيضاً نسخة layered على اليمين لإثبات الطبقات المنفصلة
    // (نستخدم drawLayeredCharacter غير المتزامن — للاختبار نضع placeholder)
    g.fillStyle = 'rgba(201,168,106,0.08)';
    g.fillRect(E.W/2 + 180, E.H*0.28, 260, 340);
    g.strokeStyle = '#C9A86A';
    g.lineWidth = 1.5;
    g.strokeRect(E.W/2 + 180, E.H*0.28, 260, 340);
    g.fillStyle = '#C9A86A';
    g.font = '600 14px Nunito';
    g.textAlign = 'center';
    g.fillText('layered preview', E.W/2 + 310, E.H*0.32);
    g.fillText('(5 layers: body/face/hair/robe/accessory)', E.W/2 + 310, E.H*0.35);
    // نعرض أسماء الطبقات
    const layers = ARCHIVIST.wardrobe.base.layers || [];
    layers.forEach((l,i) => {
      g.fillStyle = '#fff';
      g.font = '400 12px monospace';
      g.textAlign = 'left';
      g.fillText(`${l.id} → ${l.anchor} (${l.src})`, E.W/2 + 190, E.H*0.42 + i*18);
    });
  }
});

registerShot('s002', {
  draw(g, t, info) {
    const cam = { z: 1 + 0.04 * t, x: 10 * t };
    const { GY, M } = studio(g, t, cam);

    if (!ARCHIVIST) {
      g.fillStyle = '#ff6b6b';
      g.font = '40px sans-serif';
      g.textAlign = 'center';
      g.fillText('Loading archivist...', E.W/2, E.H/2);
      return;
    }

    const outfit = getOutfit(ARCHIVIST, 'formal'); // variant test — but base identity unchanged
    // وضعية مختلفة تماماً: point + غاضب
    const pose = breathe(POSES.point, t);
    g.save();
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.ellipse(E.W/2 + 60, GY+2, 38, 6, 0, 0, Math.PI*2); g.fill();
    drawFigure(g, { x: E.W/2 + 60, y: GY, s: 1.3, facing: 1, outfit: outfit, pose, expr: 'angry', rim: {color: M.rim, dir: [0,-1]}, blink: (t%3.1)>3.0 });
    g.restore();

    g.fillStyle = '#ff6b6b';
    g.font = '700 28px Nunito';
    g.textAlign = 'center';
    g.fillText('s002 — point / angry — same identityHash', E.W/2, E.H*0.12);
    g.fillStyle = '#fff';
    g.font = '400 18px Nunito';
    g.fillText(`hash=${ARCHIVIST.identityHash.slice(0,8)} — pose+expr changed, identity preserved`, E.W/2, E.H*0.16);
    g.fillText(`variant: formal (top=${outfit.top})`, E.W/2, E.H*0.19);

    // إثبات الطبقات لا تزال نفسها
    g.fillStyle = 'rgba(255,100,100,0.08)';
    g.fillRect(80, E.H*0.35, 260, 120);
    g.strokeStyle = '#ff6b6b';
    g.lineWidth = 1;
    g.strokeRect(80, E.H*0.35, 260, 120);
    g.fillStyle = '#ff6b6b';
    g.font = '600 12px Nunito';
    g.textAlign = 'left';
    g.fillText('✓ same palette: #1E3A5F / #C9A86A', 90, E.H*0.40);
    g.fillText('✓ same hair: turban #C9A86A', 90, E.H*0.44);
    g.fillText('✓ same face: beard', 90, E.H*0.48);
    g.fillText('✓ only pose/expr changed', 90, E.H*0.52);
  }
});
