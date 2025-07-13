var Ot=t=>{throw TypeError(t)};var rt=(t,e,s)=>e.has(t)||Ot("Cannot "+s);var a=(t,e,s)=>(rt(t,e,"read from private field"),s?s.call(t):e.get(t)),v=(t,e,s)=>e.has(t)?Ot("Cannot add the same private member more than once"):e instanceof WeakSet?e.add(t):e.set(t,s),p=(t,e,s,i)=>(rt(t,e,"write to private field"),i?i.call(t,s):e.set(t,s),s),g=(t,e,s)=>(rt(t,e,"access private method"),s);import{a2 as Lt,a3 as St,a4 as I,a5 as nt,a6 as K,a7 as ot,a8 as lt,a9 as It,aa as zt,ab as Nt,ac as Bt,ad as kt,ae as Ut,r as m,af as Ht,ag as Vt}from"./index-QxSUAMeM.js";var w,c,q,R,j,L,$,D,J,z,N,M,P,U,B,u,W,ct,ht,ut,dt,ft,pt,mt,_t,Dt,Wt=(Dt=class extends Lt{constructor(e,s){super();v(this,u);v(this,w);v(this,c);v(this,q);v(this,R);v(this,j);v(this,L);v(this,$);v(this,D);v(this,J);v(this,z);v(this,N);v(this,M);v(this,P);v(this,U);v(this,B,new Set);this.options=s,p(this,w,e),p(this,D,null),p(this,$,St()),this.options.experimental_prefetchInRender||a(this,$).reject(new Error("experimental_prefetchInRender feature flag is not enabled")),this.bindMethods(),this.setOptions(s)}bindMethods(){this.refetch=this.refetch.bind(this)}onSubscribe(){this.listeners.size===1&&(a(this,c).addObserver(this),Tt(a(this,c),this.options)?g(this,u,W).call(this):this.updateResult(),g(this,u,dt).call(this))}onUnsubscribe(){this.hasListeners()||this.destroy()}shouldFetchOnReconnect(){return gt(a(this,c),this.options,this.options.refetchOnReconnect)}shouldFetchOnWindowFocus(){return gt(a(this,c),this.options,this.options.refetchOnWindowFocus)}destroy(){this.listeners=new Set,g(this,u,ft).call(this),g(this,u,pt).call(this),a(this,c).removeObserver(this)}setOptions(e){const s=this.options,i=a(this,c);if(this.options=a(this,w).defaultQueryOptions(e),this.options.enabled!==void 0&&typeof this.options.enabled!="boolean"&&typeof this.options.enabled!="function"&&typeof I(this.options.enabled,a(this,c))!="boolean")throw new Error("Expected enabled to be a boolean or a callback that returns a boolean");g(this,u,mt).call(this),a(this,c).setOptions(this.options),s._defaulted&&!nt(this.options,s)&&a(this,w).getQueryCache().notify({type:"observerOptionsUpdated",query:a(this,c),observer:this});const o=this.hasListeners();o&&Qt(a(this,c),i,this.options,s)&&g(this,u,W).call(this),this.updateResult(),o&&(a(this,c)!==i||I(this.options.enabled,a(this,c))!==I(s.enabled,a(this,c))||K(this.options.staleTime,a(this,c))!==K(s.staleTime,a(this,c)))&&g(this,u,ct).call(this);const r=g(this,u,ht).call(this);o&&(a(this,c)!==i||I(this.options.enabled,a(this,c))!==I(s.enabled,a(this,c))||r!==a(this,U))&&g(this,u,ut).call(this,r)}getOptimisticResult(e){const s=a(this,w).getQueryCache().build(a(this,w),e),i=this.createResult(s,e);return qt(this,i)&&(p(this,R,i),p(this,L,this.options),p(this,j,a(this,c).state)),i}getCurrentResult(){return a(this,R)}trackResult(e,s){return new Proxy(e,{get:(i,o)=>(this.trackProp(o),s==null||s(o),Reflect.get(i,o))})}trackProp(e){a(this,B).add(e)}getCurrentQuery(){return a(this,c)}refetch({...e}={}){return this.fetch({...e})}fetchOptimistic(e){const s=a(this,w).defaultQueryOptions(e),i=a(this,w).getQueryCache().build(a(this,w),s);return i.fetch().then(()=>this.createResult(i,s))}fetch(e){return g(this,u,W).call(this,{...e,cancelRefetch:e.cancelRefetch??!0}).then(()=>(this.updateResult(),a(this,R)))}createResult(e,s){var Et;const i=a(this,c),o=this.options,r=a(this,R),n=a(this,j),h=a(this,L),f=e!==i?e.state:a(this,q),{state:y}=e;let d={...y},E=!1,b;if(s._optimisticResults){const O=this.hasListeners(),G=!O&&Tt(e,s),A=O&&Qt(e,i,s,o);(G||A)&&(d={...d,...Bt(y.data,e.options)}),s._optimisticResults==="isRestoring"&&(d.fetchStatus="idle")}let{error:H,errorUpdatedAt:V,status:C}=d;b=d.data;let Z=!1;if(s.placeholderData!==void 0&&b===void 0&&C==="pending"){let O;r!=null&&r.isPlaceholderData&&s.placeholderData===(h==null?void 0:h.placeholderData)?(O=r.data,Z=!0):O=typeof s.placeholderData=="function"?s.placeholderData((Et=a(this,N))==null?void 0:Et.state.data,a(this,N)):s.placeholderData,O!==void 0&&(C="success",b=kt(r==null?void 0:r.data,O,s),E=!0)}if(s.select&&b!==void 0&&!Z)if(r&&b===(n==null?void 0:n.data)&&s.select===a(this,J))b=a(this,z);else try{p(this,J,s.select),b=s.select(b),b=kt(r==null?void 0:r.data,b,s),p(this,z,b),p(this,D,null)}catch(O){p(this,D,O)}a(this,D)&&(H=a(this,D),b=a(this,z),V=Date.now(),C="error");const et=d.fetchStatus==="fetching",st=C==="pending",at=C==="error",wt=st&&et,Ct=b!==void 0,k={status:C,fetchStatus:d.fetchStatus,isPending:st,isSuccess:C==="success",isError:at,isInitialLoading:wt,isLoading:wt,data:b,dataUpdatedAt:d.dataUpdatedAt,error:H,errorUpdatedAt:V,failureCount:d.fetchFailureCount,failureReason:d.fetchFailureReason,errorUpdateCount:d.errorUpdateCount,isFetched:d.dataUpdateCount>0||d.errorUpdateCount>0,isFetchedAfterMount:d.dataUpdateCount>f.dataUpdateCount||d.errorUpdateCount>f.errorUpdateCount,isFetching:et,isRefetching:et&&!st,isLoadingError:at&&!Ct,isPaused:d.fetchStatus==="paused",isPlaceholderData:E,isRefetchError:at&&Ct,isStale:xt(e,s),refetch:this.refetch,promise:a(this,$),isEnabled:I(s.enabled,e)!==!1};if(this.options.experimental_prefetchInRender){const O=X=>{k.status==="error"?X.reject(k.error):k.data!==void 0&&X.resolve(k.data)},G=()=>{const X=p(this,$,k.promise=St());O(X)},A=a(this,$);switch(A.status){case"pending":e.queryHash===i.queryHash&&O(A);break;case"fulfilled":(k.status==="error"||k.data!==A.value)&&G();break;case"rejected":(k.status!=="error"||k.error!==A.reason)&&G();break}}return k}updateResult(){const e=a(this,R),s=this.createResult(a(this,c),this.options);if(p(this,j,a(this,c).state),p(this,L,this.options),a(this,j).data!==void 0&&p(this,N,a(this,c)),nt(s,e))return;p(this,R,s);const i=()=>{if(!e)return!0;const{notifyOnChangeProps:o}=this.options,r=typeof o=="function"?o():o;if(r==="all"||!r&&!a(this,B).size)return!0;const n=new Set(r??a(this,B));return this.options.throwOnError&&n.add("error"),Object.keys(a(this,R)).some(h=>{const l=h;return a(this,R)[l]!==e[l]&&n.has(l)})};g(this,u,_t).call(this,{listeners:i()})}onQueryUpdate(){this.updateResult(),this.hasListeners()&&g(this,u,dt).call(this)}},w=new WeakMap,c=new WeakMap,q=new WeakMap,R=new WeakMap,j=new WeakMap,L=new WeakMap,$=new WeakMap,D=new WeakMap,J=new WeakMap,z=new WeakMap,N=new WeakMap,M=new WeakMap,P=new WeakMap,U=new WeakMap,B=new WeakMap,u=new WeakSet,W=function(e){g(this,u,mt).call(this);let s=a(this,c).fetch(this.options,e);return e!=null&&e.throwOnError||(s=s.catch(ot)),s},ct=function(){g(this,u,ft).call(this);const e=K(this.options.staleTime,a(this,c));if(lt||a(this,R).isStale||!It(e))return;const i=zt(a(this,R).dataUpdatedAt,e)+1;p(this,M,setTimeout(()=>{a(this,R).isStale||this.updateResult()},i))},ht=function(){return(typeof this.options.refetchInterval=="function"?this.options.refetchInterval(a(this,c)):this.options.refetchInterval)??!1},ut=function(e){g(this,u,pt).call(this),p(this,U,e),!(lt||I(this.options.enabled,a(this,c))===!1||!It(a(this,U))||a(this,U)===0)&&p(this,P,setInterval(()=>{(this.options.refetchIntervalInBackground||Nt.isFocused())&&g(this,u,W).call(this)},a(this,U)))},dt=function(){g(this,u,ct).call(this),g(this,u,ut).call(this,g(this,u,ht).call(this))},ft=function(){a(this,M)&&(clearTimeout(a(this,M)),p(this,M,void 0))},pt=function(){a(this,P)&&(clearInterval(a(this,P)),p(this,P,void 0))},mt=function(){const e=a(this,w).getQueryCache().build(a(this,w),this.options);if(e===a(this,c))return;const s=a(this,c);p(this,c,e),p(this,q,e.state),this.hasListeners()&&(s==null||s.removeObserver(this),e.addObserver(this))},_t=function(e){Ut.batch(()=>{e.listeners&&this.listeners.forEach(s=>{s(a(this,R))}),a(this,w).getQueryCache().notify({query:a(this,c),type:"observerResultsUpdated"})})},Dt);function Kt(t,e){return I(e.enabled,t)!==!1&&t.state.data===void 0&&!(t.state.status==="error"&&e.retryOnMount===!1)}function Tt(t,e){return Kt(t,e)||t.state.data!==void 0&&gt(t,e,e.refetchOnMount)}function gt(t,e,s){if(I(e.enabled,t)!==!1&&K(e.staleTime,t)!=="static"){const i=typeof s=="function"?s(t):s;return i==="always"||i!==!1&&xt(t,e)}return!1}function Qt(t,e,s,i){return(t!==e||I(i.enabled,t)===!1)&&(!s.suspense||t.state.status!=="error")&&xt(t,s)}function xt(t,e){return I(e.enabled,t)!==!1&&t.isStaleByTime(K(e.staleTime,t))}function qt(t,e){return!nt(t.getCurrentResult(),e)}var jt=m.createContext(!1),Jt=()=>m.useContext(jt);jt.Provider;function Yt(){let t=!1;return{clearReset:()=>{t=!1},reset:()=>{t=!0},isReset:()=>t}}var Zt=m.createContext(Yt()),Gt=()=>m.useContext(Zt),Xt=(t,e)=>{(t.suspense||t.throwOnError||t.experimental_prefetchInRender)&&(e.isReset()||(t.retryOnMount=!1))},te=t=>{m.useEffect(()=>{t.clearReset()},[t])},ee=({result:t,errorResetBoundary:e,throwOnError:s,query:i,suspense:o})=>t.isError&&!e.isReset()&&!t.isFetching&&i&&(o&&t.data===void 0||Ht(s,[t.error,i])),se=t=>{if(t.suspense){const e=i=>i==="static"?i:Math.max(i??1e3,1e3),s=t.staleTime;t.staleTime=typeof s=="function"?(...i)=>e(s(...i)):e(s),typeof t.gcTime=="number"&&(t.gcTime=Math.max(t.gcTime,1e3))}},ae=(t,e)=>t.isLoading&&t.isFetching&&!e,re=(t,e)=>(t==null?void 0:t.suspense)&&e.isPending,Ft=(t,e,s)=>e.fetchOptimistic(t).catch(()=>{s.clearReset()});function ie(t,e,s){var d,E,b,H,V;const i=Jt(),o=Gt(),r=Vt(),n=r.defaultQueryOptions(t);(E=(d=r.getDefaultOptions().queries)==null?void 0:d._experimental_beforeQuery)==null||E.call(d,n),n._optimisticResults=i?"isRestoring":"optimistic",se(n),Xt(n,o),te(o);const h=!r.getQueryCache().get(n.queryHash),[l]=m.useState(()=>new e(r,n)),f=l.getOptimisticResult(n),y=!i&&t.subscribed!==!1;if(m.useSyncExternalStore(m.useCallback(C=>{const Z=y?l.subscribe(Ut.batchCalls(C)):ot;return l.updateResult(),Z},[l,y]),()=>l.getCurrentResult(),()=>l.getCurrentResult()),m.useEffect(()=>{l.setOptions(n)},[n,l]),re(n,f))throw Ft(n,l,o);if(ee({result:f,errorResetBoundary:o,throwOnError:n.throwOnError,query:r.getQueryCache().get(n.queryHash),suspense:n.suspense}))throw f.error;if((H=(b=r.getDefaultOptions().queries)==null?void 0:b._experimental_afterQuery)==null||H.call(b,n,f),n.experimental_prefetchInRender&&!lt&&ae(f,i)){const C=h?Ft(n,l,o):(V=r.getQueryCache().get(n.queryHash))==null?void 0:V.promise;C==null||C.catch(ot).finally(()=>{l.updateResult()})}return n.notifyOnChangeProps?f:l.trackResult(f)}function Be(t,e){return ie(t,Wt)}let ne={data:""},oe=t=>typeof window=="object"?((t?t.querySelector("#_goober"):window._goober)||Object.assign((t||document.head).appendChild(document.createElement("style")),{innerHTML:" ",id:"_goober"})).firstChild:t||ne,le=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,ce=/\/\*[^]*?\*\/|  +/g,$t=/\n+/g,F=(t,e)=>{let s="",i="",o="";for(let r in t){let n=t[r];r[0]=="@"?r[1]=="i"?s=r+" "+n+";":i+=r[1]=="f"?F(n,r):r+"{"+F(n,r[1]=="k"?"":e)+"}":typeof n=="object"?i+=F(n,e?e.replace(/([^,])+/g,h=>r.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,l=>/&/.test(l)?l.replace(/&/g,h):h?h+" "+l:l)):r):n!=null&&(r=/^--/.test(r)?r:r.replace(/[A-Z]/g,"-$&").toLowerCase(),o+=F.p?F.p(r,n):r+":"+n+";")}return s+(e&&o?e+"{"+o+"}":o)+i},T={},Mt=t=>{if(typeof t=="object"){let e="";for(let s in t)e+=s+Mt(t[s]);return e}return t},he=(t,e,s,i,o)=>{let r=Mt(t),n=T[r]||(T[r]=(l=>{let f=0,y=11;for(;f<l.length;)y=101*y+l.charCodeAt(f++)>>>0;return"go"+y})(r));if(!T[n]){let l=r!==t?t:(f=>{let y,d,E=[{}];for(;y=le.exec(f.replace(ce,""));)y[4]?E.shift():y[3]?(d=y[3].replace($t," ").trim(),E.unshift(E[0][d]=E[0][d]||{})):E[0][y[1]]=y[2].replace($t," ").trim();return E[0]})(t);T[n]=F(o?{["@keyframes "+n]:l}:l,s?"":"."+n)}let h=s&&T.g?T.g:null;return s&&(T.g=T[n]),((l,f,y,d)=>{d?f.data=f.data.replace(d,l):f.data.indexOf(l)===-1&&(f.data=y?l+f.data:f.data+l)})(T[n],e,i,h),n},ue=(t,e,s)=>t.reduce((i,o,r)=>{let n=e[r];if(n&&n.call){let h=n(s),l=h&&h.props&&h.props.className||/^go/.test(h)&&h;n=l?"."+l:h&&typeof h=="object"?h.props?"":F(h,""):h===!1?"":h}return i+o+(n??"")},"");function tt(t){let e=this||{},s=t.call?t(e.p):t;return he(s.unshift?s.raw?ue(s,[].slice.call(arguments,1),e.p):s.reduce((i,o)=>Object.assign(i,o&&o.call?o(e.p):o),{}):s,oe(e.target),e.g,e.o,e.k)}let Pt,bt,yt;tt.bind({g:1});let Q=tt.bind({k:1});function de(t,e,s,i){F.p=e,Pt=t,bt=s,yt=i}function _(t,e){let s=this||{};return function(){let i=arguments;function o(r,n){let h=Object.assign({},r),l=h.className||o.className;s.p=Object.assign({theme:bt&&bt()},h),s.o=/ *go\d+/.test(l),h.className=tt.apply(s,i)+(l?" "+l:"");let f=t;return t[0]&&(f=h.as||t,delete h.as),yt&&f[0]&&yt(h),Pt(f,h)}return o}}var fe=t=>typeof t=="function",vt=(t,e)=>fe(t)?t(e):t,pe=(()=>{let t=0;return()=>(++t).toString()})(),me=(()=>{let t;return()=>{if(t===void 0&&typeof window<"u"){let e=matchMedia("(prefers-reduced-motion: reduce)");t=!e||e.matches}return t}})(),ge=20,At=(t,e)=>{switch(e.type){case 0:return{...t,toasts:[e.toast,...t.toasts].slice(0,ge)};case 1:return{...t,toasts:t.toasts.map(r=>r.id===e.toast.id?{...r,...e.toast}:r)};case 2:let{toast:s}=e;return At(t,{type:t.toasts.find(r=>r.id===s.id)?1:0,toast:s});case 3:let{toastId:i}=e;return{...t,toasts:t.toasts.map(r=>r.id===i||i===void 0?{...r,dismissed:!0,visible:!1}:r)};case 4:return e.toastId===void 0?{...t,toasts:[]}:{...t,toasts:t.toasts.filter(r=>r.id!==e.toastId)};case 5:return{...t,pausedAt:e.time};case 6:let o=e.time-(t.pausedAt||0);return{...t,pausedAt:void 0,toasts:t.toasts.map(r=>({...r,pauseDuration:r.pauseDuration+o}))}}},be=[],it={toasts:[],pausedAt:void 0},Rt=t=>{it=At(it,t),be.forEach(e=>{e(it)})},ye=(t,e="blank",s)=>({createdAt:Date.now(),visible:!0,dismissed:!1,type:e,ariaProps:{role:"status","aria-live":"polite"},message:t,pauseDuration:0,...s,id:(s==null?void 0:s.id)||pe()}),Y=t=>(e,s)=>{let i=ye(e,t,s);return Rt({type:2,toast:i}),i.id},S=(t,e)=>Y("blank")(t,e);S.error=Y("error");S.success=Y("success");S.loading=Y("loading");S.custom=Y("custom");S.dismiss=t=>{Rt({type:3,toastId:t})};S.remove=t=>Rt({type:4,toastId:t});S.promise=(t,e,s)=>{let i=S.loading(e.loading,{...s,...s==null?void 0:s.loading});return typeof t=="function"&&(t=t()),t.then(o=>{let r=e.success?vt(e.success,o):void 0;return r?S.success(r,{id:i,...s,...s==null?void 0:s.success}):S.dismiss(i),o}).catch(o=>{let r=e.error?vt(e.error,o):void 0;r?S.error(r,{id:i,...s,...s==null?void 0:s.error}):S.dismiss(i)}),t};var ve=Q`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,xe=Q`
from {
  transform: scale(0);
  opacity: 0;
}
to {
  transform: scale(1);
  opacity: 1;
}`,Re=Q`
from {
  transform: scale(0) rotate(90deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(90deg);
	opacity: 1;
}`,we=_("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${t=>t.primary||"#ff4b4b"};
  position: relative;
  transform: rotate(45deg);

  animation: ${ve} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${xe} 0.15s ease-out forwards;
    animation-delay: 150ms;
    position: absolute;
    border-radius: 3px;
    opacity: 0;
    background: ${t=>t.secondary||"#fff"};
    bottom: 9px;
    left: 4px;
    height: 2px;
    width: 12px;
  }

  &:before {
    animation: ${Re} 0.15s ease-out forwards;
    animation-delay: 180ms;
    transform: rotate(90deg);
  }
`,Ce=Q`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`,Ee=_("div")`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${t=>t.secondary||"#e0e0e0"};
  border-right-color: ${t=>t.primary||"#616161"};
  animation: ${Ce} 1s linear infinite;
`,Oe=Q`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`,Se=Q`
0% {
	height: 0;
	width: 0;
	opacity: 0;
}
40% {
  height: 0;
	width: 6px;
	opacity: 1;
}
100% {
  opacity: 1;
  height: 10px;
}`,Ie=_("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${t=>t.primary||"#61d345"};
  position: relative;
  transform: rotate(45deg);

  animation: ${Oe} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;
  &:after {
    content: '';
    box-sizing: border-box;
    animation: ${Se} 0.2s ease-out forwards;
    opacity: 0;
    animation-delay: 200ms;
    position: absolute;
    border-right: 2px solid;
    border-bottom: 2px solid;
    border-color: ${t=>t.secondary||"#fff"};
    bottom: 6px;
    left: 6px;
    height: 10px;
    width: 6px;
  }
`,ke=_("div")`
  position: absolute;
`,Te=_("div")`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`,Qe=Q`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`,Fe=_("div")`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${Qe} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`,$e=({toast:t})=>{let{icon:e,type:s,iconTheme:i}=t;return e!==void 0?typeof e=="string"?m.createElement(Fe,null,e):e:s==="blank"?null:m.createElement(Te,null,m.createElement(Ee,{...i}),s!=="loading"&&m.createElement(ke,null,s==="error"?m.createElement(we,{...i}):m.createElement(Ie,{...i})))},De=t=>`
0% {transform: translate3d(0,${t*-200}%,0) scale(.6); opacity:.5;}
100% {transform: translate3d(0,0,0) scale(1); opacity:1;}
`,Ue=t=>`
0% {transform: translate3d(0,0,-1px) scale(1); opacity:1;}
100% {transform: translate3d(0,${t*-150}%,-1px) scale(.6); opacity:0;}
`,_e="0%{opacity:0;} 100%{opacity:1;}",je="0%{opacity:1;} 100%{opacity:0;}",Me=_("div")`
  display: flex;
  align-items: center;
  background: #fff;
  color: #363636;
  line-height: 1.3;
  will-change: transform;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1), 0 3px 3px rgba(0, 0, 0, 0.05);
  max-width: 350px;
  pointer-events: auto;
  padding: 8px 10px;
  border-radius: 8px;
`,Pe=_("div")`
  display: flex;
  justify-content: center;
  margin: 4px 10px;
  color: inherit;
  flex: 1 1 auto;
  white-space: pre-line;
`,Ae=(t,e)=>{let s=t.includes("top")?1:-1,[i,o]=me()?[_e,je]:[De(s),Ue(s)];return{animation:e?`${Q(i)} 0.35s cubic-bezier(.21,1.02,.73,1) forwards`:`${Q(o)} 0.4s forwards cubic-bezier(.06,.71,.55,1)`}};m.memo(({toast:t,position:e,style:s,children:i})=>{let o=t.height?Ae(t.position||e||"top-center",t.visible):{opacity:0},r=m.createElement($e,{toast:t}),n=m.createElement(Pe,{...t.ariaProps},vt(t.message,t));return m.createElement(Me,{className:t.className,style:{...o,...s,...t.style}},typeof i=="function"?i({icon:r,message:n}):m.createElement(m.Fragment,null,r,n))});de(m.createElement);tt`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`;const x={all:["cadd-vault"],packages:{all:()=>[...x.all,"packages"],lists:()=>[...x.packages.all(),"list"],list:t=>[...x.packages.lists(),t],infinite:t=>[...x.packages.all(),"infinite",t],details:()=>[...x.packages.all(),"detail"],detail:t=>[...x.packages.details(),t],search:t=>[...x.packages.all(),"search",t],withTag:t=>[...x.packages.all(),"tag",t]},ratings:{all:()=>[...x.all,"ratings"],package:t=>[...x.ratings.all(),t],user:(t,e)=>[...x.ratings.package(t),e]},metadata:{all:()=>[...x.all,"metadata"],tags:()=>[...x.metadata.all(),"tags"],licenses:()=>[...x.metadata.all(),"licenses"],folders:()=>[...x.metadata.all(),"folders"],categories:()=>[...x.metadata.all(),"categories"],stats:()=>[...x.metadata.all(),"stats"]}};export{Wt as Q,Be as a,S as c,x as q,ie as u};
