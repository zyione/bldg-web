import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mkdir, writeFile } from 'node:fs/promises';

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.(); }); }
};
const material = (name, color, roughness = .75) => new T.MeshStandardMaterial({ name, color, roughness });
const stone = material('Stone', '#c9bda6');
const glass = material('Glass', '#59747b', .15);
const dark = material('Metal', '#343c38');
const wood = material('Wood', '#94704b');
const floor = material('Floor', '#b89b76');
const walls = material('Walls', '#e4dfd2');
const fabric = material('Upholstery', '#ded9c9');
function box(group, size, position, mat) {
  const mesh = new T.Mesh(new T.BoxGeometry(...size), mat);
  mesh.position.set(...position); group.add(mesh); return mesh;
}
function tree(group, x, z) {
  box(group, [.16, 1.5, .16], [x, .75, z], wood);
  const crown = new T.Mesh(new T.IcosahedronGeometry(.85, 1), material('Leaves', '#52684a'));
  crown.position.set(x, 1.8, z); crown.scale.y = 1.3; group.add(crown);
}
function exterior(alternate) {
  const g = new T.Group();
  const columns = alternate ? 5 : 8, levels = alternate ? 4 : 6;
  const width = columns * 1.5;
  box(g, [42,.15,30], [0,-.15,0], material('Landscape','#919b78'));
  box(g, [32,.08,4], [0,-.02,8], material('Pavement','#c3c0b5'));
  box(g, [42,.08,4], [0,-.02,12], material('Road','#737976'));
  box(g, [width,levels*1.4,5], [0,levels*.7,0], glass);
  for(let y=0;y<=levels;y++) box(g,[width+.3,.18,5.3],[0,y*1.4,0],stone);
  for(let x=0;x<=columns;x++) {
    box(g,[.2,levels*1.4,5.3],[-width/2+x*1.5,levels*.7,0],stone);
    for(let y=0;y<levels;y++) {
      box(g,[.06,1.2,.08],[-width/2+x*1.5+.75,y*1.4+.7,2.67],dark);
    }
  }
  for(let y=1;y<levels;y++) for(let x=0;x<columns;x++) {
    box(g,[1.25,.45,.08],[-width/2+x*1.5+.75,y*1.4+.3,2.76],wood);
  }
  box(g,[2.4,.14,1.7],[0,1.5,3.2],dark);
  for(const x of [-9,-7,7,9]) tree(g,x,5);
  for(const x of [-8,8]) box(g,[3,.5,1.2],[x,.2,3.5],stone);
  return g;
}
function room(alternate) {
  const g = new T.Group();
  box(g,[10,.2,9],[0,-.1,0],floor);
  for(let x=-4.8;x<5;x+=.3) box(g,[.009,.004,9],[x,.003,0],wood);
  box(g,[10,3.8,.16],[0,1.9,-4.5],walls);
  box(g,[.16,3.8,9],[-5,1.9,0],walls);
  box(g,[.16,3.8,9],[5,1.9,0],walls);
  box(g,[10,.12,9],[0,3.85,0],walls);
  for(let x=-4.8;x<=5;x+=1.6) box(g,[.06,3.8,.08],[x,1.9,4.5],dark);
  box(g,[10,.08,.08],[0,2.7,4.5],dark);
  const rug = material('Rug','#b8ae97');
  box(g,[5,.035,4],[0,.025,0],rug);
  const sofaX = alternate ? 1.8 : -2;
  box(g,[1.2,.5,3.2],[sofaX,.4,-.5],fabric);
  box(g,[.25,.65,3.4],[sofaX-.55,.8,-.5],fabric);
  for(const z of [-2,1]) box(g,[1.35,.65,.2],[sofaX,.65,z],fabric);
  for(const z of [-1.4,-.4,.6]) box(g,[1,.16,.85],[sofaX,.73,z],fabric);
  box(g,[1.5,.12,2],[.2,.5,-.5],wood);
  box(g,[.8,.5,1.2],[.2,.25,-.5],dark);
  box(g,[.4,.08,.6],[.15,.6,-.4],walls);
  box(g,[3,.8,.6],[1.5,.4,-4.05],wood);
  box(g,[2,.95,.06],[1.5,1.5,-4.35],dark);
  box(g,[2.6,.07,1.2],[2.8,.9,2.7],wood);
  for(const x of [1.8,3.8]) for(const z of [2.1,3.3]) {
    box(g,[.5,.08,.5],[x,.5,z],fabric);
    box(g,[.5,.7,.08],[x,.8,z+.2],wood);
    box(g,[.08,.5,.08],[x,.25,z],dark);
  }
  for(const x of [-3,-2,-1]) {
    box(g,[.7,1.1,.06],[x,2,-4.38],wood);
    box(g,[.58,.98,.07],[x,2,-4.33],material('Artwork', x===-2?'#857e5a':'#c0a98e'));
  }
  tree(g,4,-3);
  return g;
}
const exporter = new GLTFExporter();
for(const [id, alt] of [['the-arc',false],['courtyard',true]]) {
  const path = `public/properties/${id}`;
  await mkdir(path,{recursive:true});
  for(const [name,group] of [['exterior',exterior(alt)],['living',room(alt)]]) {
    const glb = await exporter.parseAsync(group,{binary:true});
    await writeFile(`${path}/${name}.glb`,Buffer.from(glb));
  }
  await writeFile(`${path}/property.json`,JSON.stringify({id,name:alt?'Courtyard House':'The Arc Residences',location:'A quieter kind of city living',description:alt?'Intimate proportions. Open possibilities.':'Considered spaces. A place to belong.',exterior:'exterior.glb',camera:{position:alt?[15,9,20]:[18,11,24],target:[0,alt?2.5:4,0]},rooms:[{id:'living',name:'Living & dining',model:'living.glb',camera:{position:[3.8,2.2,3.9],target:[-1,1,-2]}}],finishes:[{name:'Natural oak',swatch:'#b89b76',materials:{Floor:'#b89b76',Walls:'#e4dfd2',Upholstery:'#ded9c9',Wood:'#94704b'}},{name:'Warm walnut',swatch:'#725443',materials:{Floor:'#725443',Walls:'#c9b9a2',Upholstery:'#a49580',Wood:'#5c4030'}}]},null,2));
}
await writeFile('public/properties/index.json',JSON.stringify(['the-arc','courtyard']));
console.log('Created original architectural GLB models and property manifests.');
