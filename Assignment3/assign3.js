import * as THREE from '../../Documentation/applications/libs/three.js-r132/build/three.module.js';
import {ARButton} from '../../Documentation/applications/libs/three.js-r132/examples/jsm/webxr/ARButton.js';
import {loadGLTF} from "../../Documentation/applications/libs/loader.js";

const normalizeModel=(obj,height)=>{
  const bbox = new THREE.Box3().setFromObject(obj);
  const size = bbox.getSize(new THREE.Vector3());
  obj.scale.multiplyScalar(height / size.y);

  const bbox2  = new THREE.Box3().setFromObject(obj);
  const center = bbox2.getCenter(new THREE.Vector3());
  obj.position.set(-center.x,-center.y,-center.z);
}
const setOpacity = (obj,op)=>{
  obj.children.forEach((child) => {
    setOpacity(child,op);
  });
  if(obj.material)
  {
    obj.material.format = THREE.RGBAFormat;
    obj.material.opacity = op;
  }
}
const deepClone = (obj) =>{
  const newObj = obj.clone();
  newObj.traverse((o)=>{
    if(o.isMesh)
    {
      o.material = o.material.clone();
    }
    
  });
  return newObj;
}
document.addEventListener('DOMContentLoaded', () => {
  const initialize = async() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff,1);
    scene.add(light);

    const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true}); //These options enable antialiasing (to smooth out edges) and alpha transparency (allowing the background to be transparent).
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
  
    const arButton = ARButton.createButton(renderer, {requiredFeatures: ['hit-test'],optionalFeatures: ['dom-overlay'], domOverlay: {root: document.body}});
    // it enables the dom-overlay feature, allowing standard HTML elements to be displayed on top of the AR content, with the root of the overlay set to the entire document body.
    document.body.appendChild(renderer.domElement);
    document.body.appendChild(arButton);

    let itemNames = ['coffee-table','chair','cushion'];
    let itemHeights =[0.5,0.7,0.05];
    let items = [];
    for(let i =0;i<itemNames.length;i++)
    {
      const model = await loadGLTF("../../Documentation/applications/assets/models/"+itemNames[i]+"/scene.gltf");
      normalizeModel(model.scene,itemHeights[i]);
      const item = new THREE.Group();
      item.add(model.scene);
      item.visible=false;
      setOpacity(item,0.5);
      items.push(item);
      scene.add(item);
    }

    let selectedItem=null;
    let prevTouchPosition=null;
    let touchDown = false;

    const confirmbtn= document.querySelector("#confirm-buttons");
    const itmbtn = document.querySelector("#item-buttons");
    itmbtn.style.display = "block";
    confirmbtn.style.display = "none";

    const select = (selectItem)=>{
      items.forEach((item)=>{
        item.visible = item === selectItem;
      });
      selectedItem=selectItem;
      confirmbtn.style.display='block';
      itmbtn.style.display='none';
    }

    const cancelSelect = ()=>{
      confirmbtn.style.display='none';
      itmbtn.style.display='block';
      if(selectedItem)
      {
        selectedItem.visible=false;
      }
      selectedItem=null;
    }

      const placeItm  = document.querySelector("#place");
      const cancelItm  = document.querySelector("#cancel");
     placeItm.addEventListener("beforexrselect",(e)=>{
      e.preventDefault();
     });
     placeItm.addEventListener("click",(e)=>{
      e.preventDefault();
      e.stopPropagation();
      const spawnItm = deepClone(selectedItem);
      setOpacity(spawnItm,1.0);
      scene.add(spawnItm);
      cancelSelect();
     });
     cancelItm.addEventListener("beforexrselect",(e)=>{
      e.preventDefault();
     });
     cancelItm.addEventListener("click",(e)=>{
      e.preventDefault();
      e.stopPropagation();
      cancelSelect();
     });
     for(let i=0;i<items.length;i++)
     {
      const el = document.querySelector("#item"+i);
      el.addEventListener("beforexrselect",(e)=>{
        e.preventDefault();
      });
      el.addEventListener("click",(e)=>{
        e.preventDefault();
        e.stopPropagation();
        select(items[i]);
      })
     }
    const controller = renderer.xr.getController(0);
   scene.add(controller); 
    controller.addEventListener('selectstart',(e) => {
      touchDown=true;
    });
    controller.addEventListener('selectend',(e)=>{
      touchDown=false;
      prevTouchPosition=null;
    })

    renderer.xr.addEventListener("sessionstart",async(e)=>{
      const session = renderer.xr.getSession();
      const viewerReferenceSpace = await session.requestReferenceSpace("viewer");
      const hitTestSource = await session.requestHitTestSource({space:viewerReferenceSpace});

      renderer.setAnimationLoop((timestamp, frame) => {
        if (!frame) return;
      
        const referenceSpace = renderer.xr.getReferenceSpace(); // ARButton requested 'local' reference space
        if (touchDown && selectedItem) {
          const viewerMatrix = new THREE.Matrix4().fromArray(frame.getViewerPose(referenceSpace).transform.inverse.matrix);
          // This matrix is used to transform coordinates from world space to viewer (camera) space.
          const newPosition = controller.position.clone();
          newPosition.applyMatrix4(viewerMatrix); // change to viewer coordinate
          if (prevTouchPosition) {
            const deltaX = newPosition.x - prevTouchPosition.x;
            const deltaZ = newPosition.y - prevTouchPosition.y;
           // deltaX and deltaZ are calculated as the differences between the new position and the previous touch position along the x and y axes, respectively.
            selectedItem.rotation.y += deltaX * 30;
          }
          prevTouchPosition = newPosition;
        }
      
        if (selectedItem) {
          const hitTestResults = frame.getHitTestResults(hitTestSource);
          if (hitTestResults.length) {
            const hit = hitTestResults[0];
            selectedItem.visible = true;
            selectedItem.position.setFromMatrixPosition(new THREE.Matrix4().fromArray(hit.getPose(referenceSpace).transform.matrix));
          } else {
            selectedItem.visible = false;
          }
        }
      
        renderer.render(scene, camera);
            });
      
    })

  }

  initialize();
});
