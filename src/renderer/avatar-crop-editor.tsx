import { useRef, useState } from 'react';
import { avatarCropRectangle, centeredCrop, type AvatarCrop, type AvatarDraft } from '../shared/avatar-crop';
import { Modal } from './ui';

export function AvatarCropEditor({ draft, onSave, onCancel }: { draft: AvatarDraft; onSave(crop: AvatarCrop): Promise<boolean>; onCancel(): void }) {
  const [crop,setCrop]=useState<AvatarCrop>({...centeredCrop}),[busy,setBusy]=useState(false);
  const drag=useRef<{x:number;y:number;crop:AvatarCrop}|null>(null),rect=avatarCropRectangle(draft.width,draft.height,crop);
  const clamp=(n:number)=>Math.min(1,Math.max(0,n));
  return <Modal title="Crop your profile photo" subtitle="Drag to position your photo, or use the sliders. Only the saved square icon is stored." onClose={()=>{if(!busy)onCancel();}}>
    <form className="editor crop-editor" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await onSave(crop);}finally{setBusy(false);}}}>
      <div className="crop-preview" aria-label="Profile photo crop preview" onPointerDown={e=>{if(busy)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,crop};}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onPointerMove={e=>{
        const start=drag.current;if(!start||busy)return;const size=e.currentTarget.getBoundingClientRect().width,source=avatarCropRectangle(draft.width,draft.height,start.crop);
        setCrop({...start.crop,horizontal:draft.width===source.width?0.5:clamp(start.crop.horizontal-(e.clientX-start.x)*source.width/size/(draft.width-source.width)),vertical:draft.height===source.height?0.5:clamp(start.crop.vertical-(e.clientY-start.y)*source.height/size/(draft.height-source.height))});
      }}><img draggable={false} src={draft.preview} alt="Selected photo" style={{width:`${draft.width/rect.width*100}%`,height:`${draft.height/rect.height*100}%`,left:`${-rect.x/rect.width*100}%`,top:`${-rect.y/rect.height*100}%`}}/></div>
      <label>Zoom ({crop.zoom.toFixed(2)}×)<input type="range" aria-label="Photo zoom" min="1" max="4" step="0.01" disabled={busy} value={crop.zoom} onChange={e=>setCrop({...crop,zoom:Number(e.target.value)})}/></label>
      <label>Horizontal position<input type="range" min="0" max="1" step="0.01" disabled={busy||draft.width===rect.width} value={crop.horizontal} onChange={e=>setCrop({...crop,horizontal:Number(e.target.value)})}/></label>
      <label>Vertical position<input type="range" min="0" max="1" step="0.01" disabled={busy||draft.height===rect.height} value={crop.vertical} onChange={e=>setCrop({...crop,vertical:Number(e.target.value)})}/></label>
      <footer className="modal-actions"><button type="button" className="text-button" disabled={busy} onClick={()=>setCrop({...centeredCrop})}>Reset crop</button><button type="button" className="button secondary" disabled={busy} onClick={onCancel}>Cancel</button><button className="button primary" disabled={busy}>{busy?'Saving…':'Save photo'}</button></footer>
    </form>
  </Modal>;
}
