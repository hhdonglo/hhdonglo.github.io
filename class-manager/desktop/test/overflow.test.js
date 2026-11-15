"use strict";
// No horizontal page scroll on any CM screen, even with very long folder paths, repository URLs and names.
// Needs Playwright (present in the build environment); it is skipped where it is not installed.
const test = require("node:test"), assert = require("node:assert"), path = require("path");
let chromium = null;
try { chromium = require("playwright").chromium; } catch (e) { /* skipped below */ }

const LONG = "/Users/someone/Documents/Work/Research_work/My_Library/UG_Lectures/PHYS_143_course_pack/with-a-very-long-folder-name/and-more/and-more/and-more";
const URL_ = "https://github.com/someone-with-a-long-name/an-extremely-long-repository-name-for-lectures-and-question-banks-2026-27";
const STUB = `(function(){
 var long=${JSON.stringify(LONG)},url=${JSON.stringify(URL_)};
 var course={id:"phys143",code:"PHYS 143",title:"Introductory Mechanics and a Very Long Course Title That Keeps Going",term:"2026/27",current:true,source:{kind:"folder",path:long},repo:{url:url,branch:"main"}};
 var map={courses:function(){return{ok:true,list:[course],current:"phys143"}},
  info:function(){return{ok:true,me:{repo:course.repo,source:course.source},source:course.source,repo:course.repo}}};
 window.cmApp=new Proxy({},{get:function(_,k){return function(){return Promise.resolve(map[k]?map[k]():Object.assign([],{ok:true,list:[],rows:[],items:[],banks:[],docs:[],connected:false}))}},has:function(){return true}});
})();`;

test("no screen scrolls sideways at narrow and normal widths", { skip: !chromium && "Playwright is not installed" }, async () => {
  const browser = await chromium.launch();
  const bad = [];
  try {
    for (const width of [760, 1000, 1280]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 } });
      await ctx.addInitScript(STUB);
      const pg = await ctx.newPage();
      await pg.goto("file://" + path.join(__dirname, "..", "app", "home.html"));
      await pg.waitForTimeout(500);
      const views = await pg.$$eval("button.nav[data-view]", (b) => b.map((x) => x.getAttribute("data-view")));
      assert.ok(views.length >= 8, "found the sidebar screens");
      for (const v of views) {
        await pg.click(`button.nav[data-view="${v}"]`);
        await pg.waitForTimeout(150);
        const o = await pg.evaluate(() => {
          const m = document.querySelector("main");
          return { page: document.documentElement.scrollWidth - innerWidth, main: m.scrollWidth - m.clientWidth };
        });
        if (o.page > 1 || o.main > 1) bad.push(`${v} at ${width}px: page +${o.page}, main +${o.main}`);
      }
      await ctx.close();
    }
  } finally { await browser.close(); }
  assert.deepStrictEqual(bad, []);
});
