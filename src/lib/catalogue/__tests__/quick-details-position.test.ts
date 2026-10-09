import {describe,it,expect} from 'vitest';
import {quickDetailsPosition} from '../quick-details-position';
describe('pointer-anchored quick details',()=>{
 it('uses the pointer rather than the top of a tall row',()=>{expect(quickDetailsPosition({x:600,y:500},{width:420,height:180},{width:1400,height:900})).toEqual({left:614,top:514});});
 it('measures a short card so it can stay below the pointer near the viewport bottom',()=>{expect(quickDetailsPosition({x:100,y:700},{width:420,height:100},{width:1400,height:900}).top).toBe(714);});
 it('flips at edges with a small gap and stays in phone safe margins',()=>{
  expect(quickDetailsPosition({x:1200,y:800},{width:420,height:200},{width:1400,height:900})).toEqual({left:766,top:586});
  const place=quickDetailsPosition({x:300,y:720},{width:366,height:300},{width:390,height:844});expect(place.left).toBe(12);expect(place.top).toBe(406);
 });
});
