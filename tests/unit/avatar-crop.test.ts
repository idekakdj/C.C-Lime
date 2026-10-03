import { expect, it } from 'vitest';
import { avatarCropRectangle } from '../../src/shared/avatar-crop';
it('positions square crops at center and both edges of landscape and portrait images',()=>{
  expect(avatarCropRectangle(600,200,{zoom:1,horizontal:0.5,vertical:0.5})).toEqual({x:200,y:0,width:200,height:200});
  expect(avatarCropRectangle(600,200,{zoom:2,horizontal:1,vertical:1})).toEqual({x:500,y:100,width:100,height:100});
  expect(avatarCropRectangle(200,600,{zoom:4,horizontal:0,vertical:1})).toEqual({x:0,y:550,width:50,height:50});
  expect(avatarCropRectangle(1,1,{zoom:4,horizontal:1,vertical:0})).toEqual({x:0,y:0,width:1,height:1});
});
it('rejects invalid crop coordinates and dimensions instead of accepting renderer input',()=>{
  for(const zoom of [NaN,Infinity,0,4.01])expect(()=>avatarCropRectangle(100,100,{zoom,horizontal:0.5,vertical:0.5})).toThrow();
  for(const horizontal of [-0.01,1.01,Infinity])expect(()=>avatarCropRectangle(100,100,{zoom:1,horizontal,vertical:0.5})).toThrow();
  for(const width of [0,4097,1.5])expect(()=>avatarCropRectangle(width,100,{zoom:1,horizontal:0.5,vertical:0.5})).toThrow();
});
