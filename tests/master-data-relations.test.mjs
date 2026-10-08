import test from 'node:test';
import assert from 'node:assert/strict';
import sourceLoader from './load-source.mjs';
const plain = value => JSON.parse(JSON.stringify(value));
function setup(handler = () => ({ data: { size_id: 8, category_id: 7 } })) {
  const calls = [];
  const axios = Object.fromEntries(['get','post','patch','delete'].map(method => [method, async (...args) => {
    calls.push([method,...plain(args)]);
    return handler(method,...args);
  }]));
  const load = sourceLoader({ '@/lib/axios': axios });
  return { calls, size: new (load('src/models/size.ts').default)(), category: new (load('src/models/category.ts').default)() };
}
for (const [name, run, expected] of [
  ['create size with two categories', s => s.size.createSize({size_name:'XL',category_ids:[2,3]}), ['post','/sizes/',{size_name:'XL',category_ids:[2,3]}]],
  ['clear size categories', s => s.size.updateSize({size_id:8,size_name:'XL',category_ids:[]}), ['patch','/sizes/8',{size_name:'XL',category_ids:[]}]],
  ['omitted size categories', s => s.size.updateSize({size_id:8,size_name:'XL'}), ['patch','/sizes/8',{size_name:'XL'}]],
  ['create category with three sizes', s => s.category.createCategory('เสื้อ',[1,2,3]), ['post','/category/',{category_name:'เสื้อ',size_ids:[1,2,3]}]],
  ['clear category sizes', s => s.category.updateCategory({category_id:7,category_name:'เสื้อ',size_ids:[]}), ['patch','/category/7',{category_name:'เสื้อ',size_ids:[]}]],
  ['omitted category sizes', s => s.category.updateCategory({category_id:7,category_name:'เสื้อ'}), ['patch','/category/7',{category_name:'เสื้อ'}]],
]) test(name+' uses exactly one atomic request',async()=>{const s=setup();await run(s);assert.deepEqual(s.calls,[expected]);});
test('size detail reads size API and supports empty relations', async()=>{
 const s=setup(()=>({data:{size_id:8,size_name:'XL',category_ids:[],category:[]}}));
 assert.deepEqual(plain(await s.size.getCategoryRelationsBySize(8)),{category_ids:[],category:[]});
 assert.equal(s.calls.length,1);assert.equal(s.calls[0][1],'/sizes/8');
});
test('category list derives distinct counts per row with one request',async()=>{
 const s=setup(()=>({data:{data:[{category_id:1,category_name:'A',categorySize:[{size_id:4},{size_id:5},{size_id:5}]},{category_id:2,category_name:'B',categorySize:[]}],meta:{total:2,page:1,limit:10,last_page:1}}}));
 const rows=(await s.category.getCategories()).data;
 assert.deepEqual(plain(rows.map(r=>r.size_ids)),[[4,5],[]]);assert.equal(s.calls.length,1);
});
test('write failures propagate original Thai error with no fallback writes',async()=>{
 for(const status of [400,409,500]) for(const operation of ['size','category']){
  const error=Object.assign(new Error('บันทึกไม่สำเร็จ'),{response:{status}});const s=setup(()=>{throw error;});
  await assert.rejects(operation==='size'?s.size.createSize({size_name:'XL',category_ids:[2]}):s.category.createCategory('เสื้อ',[1]),e=>e===error);
  assert.equal(s.calls.length,1);
 }
});
test('all size options paginate legally without truncating after 100',async()=>{
 const s=setup((method,url,config)=>{
  assert.equal(method,'get');assert.equal(url,'/sizes/');assert.equal(config.params.limit,100);
  const p=config.params.page;return {data:{data:Array.from({length:p===3?5:100},(_,i)=>({size_id:(p-1)*100+i+1,size_name:'size'})),meta:{total:205,page:p,limit:100,last_page:3}}};
 });const {data:list}=await s.size.getAllSizes();assert.equal(list.length,205);assert.equal(list.at(-1).size_id,205);assert.equal(s.calls.length,3);
});

test('category update sends only fields the strict API accepts, even from a full list row (TASK-0142)',async()=>{
 const listed={data:{data:[{category_id:7,category_name:'เสื้อ',categorySize:[{id:1,size_id:4},{id:2,size_id:5}],sizes:[{size_id:4}],unknownLater:true}],meta:{total:1,page:1,limit:10,last_page:1}}};
 const s=setup(()=>listed);
 const [row]=(await s.category.getCategories()).data;
 s.calls.length=0;
 await s.category.updateCategory({...row,category_name:'เสื้อยืด'});
 assert.deepEqual(s.calls,[['patch','/category/7',{category_name:'เสื้อยืด',size_ids:[4,5]}]]);
 s.calls.length=0;
 await s.category.updateCategory({...row,size_ids:undefined});
 assert.deepEqual(s.calls,[['patch','/category/7',{category_name:'เสื้อ'}]]);
});
