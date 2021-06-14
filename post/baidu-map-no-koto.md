# 百度地图那点事

本文主要探讨百度地图的坐标偏移以及逆地理编码相关。最近我尝试在Leaflet上展示百度地图，用于可视化演示。虽然有很多其他选择，但领导决定用百度地图了，前期也都利用百度地图去设计的，所以得用了。当然，我也需要验证一下我之前的说法，因为我跟领导说用Leaflet，市面上常用的这几个地图接入都是没问题的。那百度一定是其中之一对吧。

## Leaflet接百度地图实操

同事下载的地图瓦片是“原始API”瓦片。这种瓦片对于百度JS API来说，调用起来几乎就不需要任何配置，就能调用成功。但我知道，这样我们就一定会多出学习百度API的时间，而且能够实现的功能将会受制于百度JS API的功能范围，而且关键是我们其实根本没用到百度的后台，只是用一个瓦片而已。于是我开始尝试用Leaflet来接入这种瓦片。

Leaflet接百度地图这件事并没有我之前想象的那么简单。其实我知道这件事一定是能搞成的，但问题就出在网上的说明不够详细，我又忽略了某个关键的点，所以在这件事情上稍稍花费了些时间。

Leaflet接百度地图的最好参考资料就是Leaflet的插件Leaflet.ChineseTmsProviders。但它依赖了proj4js.js。我想试试看能不能找到不用这个库的实现，但这让我绕了些弯路。别的实现确实也能接入百度，但是代码不好改，改了之后就出问题了。但我还需要解决地图偏移的问题。因为如果不能解决地图偏移的问题，我以后所有的坐标都需要转换成垃圾的百度坐标。这是我不能接受的。

在我尝试有点困难的时候，我想到让同事直接下载无偏移的百度地图，并且用原来我接入过的ArcGIS切片方式。（这一点大家要注意，百度地图不只在地图上有偏移，切片方式也不正常。切片方式不常规，拼出来的地图就有可能乱掉。）用这种方式，我果然不费吹灰之力，就接上了地图，并且位置也是准的。可是，我发现地图的字出现了模糊。稍微一想，就明白了，这是因为我强行把百度地图投影到Web Mercator的结果。百度地图没有标准Web Mercator的投影，投影过来，地图上的字就会花掉。

于是我重新尝试直接接百度API瓦片。我最终还是用了Leaflet.ChineseTmsProviders中的实现方案。

```js
const baiduBase = new L.Proj.CRS('EPSG:900913', '+proj=merc +a=6378206 +b=6356584.314245179 +lat_ts=0.0 +lon_0=0.0 +x_0=0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext  +no_defs', {
    resolutions: function () {
        level = 19
        var res = [];
        res[0] = Math.pow(2, 18);
        for (var i = 1; i < level; i++) {
            res[i] = Math.pow(2, (18 - i))
        }
        return res;
    }(),
    origin: [0, 0],
    bounds: L.bounds([20037508.342789244, 0], [0, 20037508.342789244])
});
```

这段简单的代码就是为了解决百度坐标系以及切片与标准不同的问题的。但我一开始只用这段代码发现还是不对。因为有一个关键，就是百度的CRS仍然是基于TMS的，所以在选项里tms一定要写成true，而且注意，tms这个参数是在tileLayer里面的，而crs是在map里的，一定不要弄错。

```js
var map = L.map('mapid', {
    crs: L.CRS.Baidu
}).setView([39.90556, 116.39139], 12);

L.tileLayer(mapUrl + '/baidutile/{z}/{x}/{y}.png', {
    tms: true
}).addTo(map);
```

如此以来，百度的图就能顺利地接进来了。但是注意，这个图是有偏的。另一个repo解决了这个问题。它叫做Leaflet.InternetMapCorrection。但是他的实现方式我不太满意。这是他的代码，给大家看一下：

```js
L.GridLayer.include({
  _setZoomTransform: function (level, _center, zoom) {
    var center = _center;
    if (center != undefined && this.options) {
      center = L.coordConver().gps84_To_bd09(_center.lng, _center.lat);
    }
    var scale = this._map.getZoomScale(zoom, level.zoom),
      translate = level.origin.multiplyBy(scale)
      .subtract(this._map._getNewPixelOrigin(center, zoom)).round();

    if (L.Browser.any3d) {
      L.DomUtil.setTransform(level.el, translate, scale);
    } else {
      L.DomUtil.setPosition(level.el, translate);
    }
  },
  _getTiledPixelBounds: function (_center) {
    var center = _center;
    if (center != undefined && this.options) {
      center = L.coordConver().gps84_To_bd09(_center.lng, _center.lat);
    }
    var map = this._map,
      mapZoom = map._animatingZoom ? Math.max(map._animateToZoom, map.getZoom()) : map.getZoom(),
      scale = map.getZoomScale(mapZoom, this._tileZoom),
      pixelCenter = map.project(center, this._tileZoom).floor(),
      halfSize = map.getSize().divideBy(scale * 2);

    return new L.Bounds(pixelCenter.subtract(halfSize), pixelCenter.add(halfSize));
  }
})
```

能看出他是努力搞定这件事了。他把GridLayer的某两个内部方法给覆盖掉了。这种方式虽然有效，但是我有一个担心，担心有些方法没有用到这两个内部方法，那样不就有可能造成问题了嘛。

那么我怎么实现的呢？我个人认为解决投影方式不同的方式，应当从投影入手，不是吗？当然我目前没有看到他的实现有什么副作用，包括我担心的，两个地图对比联动的时候，是不是会影响另一个地图的显示？结果是没有，而且联动得很好。我还有担心，它这种方法找一个非中心点的坐标，会不会出问题，好像也没问题。好啦不说废话，把我的代码给大家看一下

```js
baiduBase.projection.project = function(latlng) {
    return oldProject.call(bdProj, lon2lng(
        PRCoords.wgs_bd(lng2lon(latlng))
    ));
}

baiduBase.projection.unproject = function(point, unbounded) {
    const result = PRCoords.bd_wgs(
        lng2lon(oldUnproject.call(bdProj, point, unbounded))
    );
    return new L.latLng(result);
}
```

我重写了project和unproject，也就是从投影入手。另外其实想要说一下，其实proj4leaflet重写的也就是这两个函数，我在默认投影的基础上，再加一层纠偏投影，应该不成问题。baiduBase这个CRS，想要给它纠偏，我的思路就是在它原来投影过程中用到坐标的地方，都用PRCoords转换一遍。这里要分享一下朋友的坐标纠偏库，我个人非常喜欢用，而且有[网页版](https://artoria2e5.github.io/PRCoords/demo.html)，对于大家来说也可以不写一行代码在上面转换坐标。

我其实在我一个开源项目里用到了InternetMapCorrection这个库来接入多个国内地图。这个开源项目的名字就叫做[new_osm](https://github.com/AlexanderMisel/new_osm)，提供了包括百度地图在内的多种地图与OpenStreetMap的对比，都映射到了WGS84坐标。这个项目的实现可供大家参考。

## 我如何批量刷百度的地理编码

可能刚接触或者没接触过地图的朋友没听过“地理编码”这个词。

> 地理编码（英文：geocoding）是将文字描述的位置信息（如地址或地点名称），转换成地理坐标（通常是经纬度）以确定在地球表面位置的过程。

我们普通人对于位置的认知通常是通过文字描述，但专业而且机器能够准确定位的方式则是坐标的形式。一般来说地理编码系统能够处理的文字就是这样的：

- XX市XX区XX大街X号
- XX路与XX街交叉口西30米
- XX酒店、XX网吧

这些数据通常是存储在我们的数据库里的。当然我们也可以导出成简单的文本格式，如csv处理。像百度地图、高德地图之类成熟的商业地图都会有地理编码服务的。批量刷其实就是写一个程序嘛。我一般不把这种程序称之为爬虫，在我的观念里，批量访问别人的HTML页，然后通过强行从中解析出数据的，才能叫爬虫。咱这直接通过调用接口的程序，不能算啦。

我首先想到的就是百度地图的JS SDK。从这里入手，看看人家例子是怎么请求的，我们仿造一个。官方的链接在[这里](https://lbsyun.baidu.com/jsdemo.htm#wAddressParseGroup)。我想，既然是JS的，我写个deno的程序调用呗。结果就发现，怎么搞都搞不成功，我觉得可能是deno的HTTP请求有什么能让百度侦测到的地方。但这也不是能让我曲尊用Node.js写的理由。我决定用Lua来写这个程序，正好我之前用Lua封装过libcurl的GET请求，不过封装得太简单了。

大家知道cURL是一个测试发送网络请求的瑞士军刀。你在浏览器上发出的任何请求，都可以原封不动地翻译成cURL语句，在命令行执行。在浏览器里F12，打开网络请求面板，找到你想要的请求，右键“复制为cURL命令”就会把完整的请求的语句复制出来。我们来看看例子中其中一个语句：（我把语句处理了一下，URL编码重新恢复成了文字，真实Cookie隐去了）

```bash
curl 'https://api.map.baidu.com/?qt=gc&wd=包河区金寨路1号（金寨路与望江西路交叉口）&cn=合肥市&ie=utf-8&oue=1&fromproduct=jsapi&res=api&callback=BMapGL._rd._cbk48402&ak=E4805d16520de693a3fe707cdc962045&v=3.0&seckey=&timeStamp=1623665752686' \
  -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0' \
  -H 'Accept: */*' -H 'Accept-Language: zh-CN,zh;q=0.8,ja;q=0.6,en-US;q=0.4,en;q=0.2' --compressed \
  -H 'Connection: keep-alive' -H 'Referer: http://lbsyun.baidu.com/' \
  -H 'Cookie: Cookie: xxx' -H 'Pragma: no-cache' -H 'Cache-Control: no-cache'
```

我们看到这里面主要用到的就是增加header。所以我封装了一个允许传入header的GET请求。大概代码如下

```lua
local function httpsget(url, headers, retry_times)
  local t = {}
  local h_strs = nil
  
  if headers then
    h_strs = {}
    local i = 0
    for k, v in pairs(headers) do
      table.insert(h_strs, k .. ': ' .. v)
    end
  end

  local e = assert(curl.easy{
    url = url,
    failonerror = true,
    httpheader = h_strs,
    accept_encoding = 'gzip, deflate',
    ssl_verifyhost = false,
    ssl_verifypeer = false,
    timeout = 60,
    writefunction = function(data, size)
      if size == 0 then return 0 end
      table.insert(t, ffi.string(data, size))
      return size
    end
  })

  local res, err, ecode
  for i = 1, retry_times do
    t = {}
    --print('attempt ' .. i)
    res, err, ecode = e:perform()
    if res then break end
  end
  e:close()
  if not res then return nil, err, ecode end
  return table.concat(t)
end
```

说实话，使用libcurl和cURL命令行参数的感受还是很不一样的。需要认真看文档才会用。cURL封装完，网络请求就有了，不用再操心什么HTTP和HTTPS请求不一样的问题，让cURL去处理吧。返回结果之后，我发现不对。WHAT？

```json
"coord":{"x":"13054635.4874","y":"3719173.76885"}}
```

这是什么坐标？凭着我之前的经验，这应该是投影后的坐标，而且应该是墨卡托投影。于是我用标准的墨卡托投影反向转换为坐标，然后把坐标换算成百度坐标，我发现，依然偏移，而且偏得不小。这可不行。上网查了才知道，百度地图返回的坐标是独特的“百度墨卡托”投影坐标。不过呢，也不是转换不回来。有人就从百度JS API里扒出了这段转换代码，我给改写成了Lua。

```lua
local MCBAND = { 12890594.86, 8362377.87, 5591021, 3481989.83, 1678043.12, 0 }
local MC2LL = { ... } -- 此处省略

local function convertor(T, hS)
  if not T or not hS then
    return
  end
  local e = hS[1] + hS[2] * math.abs(T.lng)
  local i = math.abs(T.lat) / hS[10]
  local hT = hS[3] + hS[4] * i + hS[5] * i * i + hS[6] * i * i * i + hS[7] * i * i * i * i + hS[8] * i * i * i * i * i + hS[9] * i * i * i * i * i * i
  e = e * (T.lng < 0 and -1 or 1)
  hT = hT * (T.lat < 0 and -1 or 1)
  return { lng = e, lat = hT }
end

local function convertMC2LL(e)
  if e == nil then
    return e
  end
  if not e then
    return { lat = 0, lng = 0 }
  end
  local T, hT
  T = { lat = math.abs(e.lat), lng = math.abs(e.lng) }
  for hS = 1, #MCBAND do
    if T.lat >= MCBAND[hS] then
      hT = MC2LL[hS]
      break
    end
  end
  return convertor(e, hT)
end
```

总之就是用它预先计算好的参数给咱整了一通多项式，最后算出来的坐标就是BD-09坐标。居然还不是WGS82，可以！没事我又把prcoord改写成了Lua语言，代码不贴了，请参考原JS实现。然后我们就可以写geocode函数了

```lua
function baidu_geocode(name, city)
  local res, err, ecode = curl_http.httpsget(
      'http://api.map.baidu.com/?' .. curl_http.params{
        qt = 'gc',
        wd = name,
        cn = city,
        ie = 'utf-8',
        oue = 1,
        fromproduct = 'jsapi',
        res = 'api',
        callback = 'test',
        ak = 'E4805d16520de693a3fe707cdc962045',
        v = '3.0'
      },
      {
        ['Connection'] = 'keep-alive',
        ['User-Agent'] = 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.66 Safari/537.36',
        ['Accept'] = '*/*',
        ['Referer'] = 'http://lbsyun.baidu.com/',
        ['Accept-Language'] = 'zh-CN,zh;q=0.9,en;q=0.8,ja;q=0.7,zh-TW;q=0.6',
        ['Cookie'] = 'xxx'
      },
      1
    )

  if res then
    local x, y = res:match('"coord":{"x":"([%d.]+)","y":"([%d.]+)"}')
    local point = convertMC2LL({ lng = tonumber(x), lat = tonumber(y) })
    return prcoord.bd_to_wgs(point)
  end
end
```

这样我们就能拿到地理编码后的坐标了。是不是很简单呢？高德的话更加容易。为什么我说更加容易呢？其一是高德的JS用的API和Web服务API是一套接口，而百度是两套；高德没有百度墨卡托的幺蛾子事，用标准的转换方法就可以转换；高德没有防跨域，所有接口都是`Accept: */*`，这让我们直接网页调用容易了一些，百度的话，网页调用应该只能JSONP。

---

关于地图相关的事情，其实我还没有讲完。前一阵子工作，用到地图、经纬度的地方，基本上就是我上，所以也就逐渐地积累这方面经验。以我这记性，经验不写下来迟早忘掉，所以还会继续整理成博客给大家看。[∎](../ "返回首页")