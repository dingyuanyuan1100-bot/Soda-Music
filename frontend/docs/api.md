# KuGouMusic API

当前文档整理本前端实际使用的接口，写法参考 [KuGouMusicApi 官方文档](https://kugoumusicapi-docs.4everland.app/#/?id=kugoumusic-api)。

## 调用前须知

!> 当前前端分两层调用：稳定搜索、专辑、歌手、MV、播放地址优先走 `http://47.116.42.11/api`；登录、验证码、二维码、歌词、封面走 `http://47.116.42.11/raw-api`。

!> 登录态保存在浏览器本地，包括 `token / userid / dfid`。请求阶段由前端统一拼接 `cookie` 参数。

!> 二维码、验证码、登录、刷新 token 等接口会追加 `timestamp`，避免接口缓存导致状态不更新。

!> 返回 `{"code":4404,"message":"no playable source"}` 或无法解析出播放 URL 时，前端直接标记为无音源并跳过。

## 登录

### 手机号登录

说明：使用短信验证码登录。

**必选参数：**

`mobile`: 手机号

`code`: 验证码，使用 `/captcha/sent` 获取

**接口地址：** `/login/cellphone`

**调用例子：**

```text
/raw-api/login/cellphone?mobile=13800138000&code=123456&platform=life&timestamp=1691256061923
```

### 发送验证码

说明：发送手机短信验证码。验证码可能存在延迟，不要短时间反复调用。

**必选参数：**

`mobile`: 手机号

**接口地址：** `/captcha/sent`

**调用例子：**

```text
/raw-api/captcha/sent?mobile=13800138000&platform=life&timestamp=1691256061923
```

### 二维码 key 生成接口

说明：生成二维码登录所需的 key。

**接口地址：** `/login/qr/key`

**调用例子：**

```text
/raw-api/login/qr/key?platform=life&timestamp=1691256061923
```

### 二维码生成接口

说明：传入 key，生成二维码图片或二维码链接。

**必选参数：**

`key`: `/login/qr/key` 返回的 key

**可选参数：**

`qrimg`: 为 `true` 时返回 base64 二维码图片

**接口地址：** `/login/qr/create`

**调用例子：**

```text
/raw-api/login/qr/create?key=xxx&qrimg=true&platform=life&timestamp=1691256061923
```

### 二维码检测扫码状态接口

说明：轮询二维码扫码状态。

**状态说明：**

- `0`: 二维码已过期
- `1`: 等待扫码
- `2`: 已扫码，等待确认
- `3`: 处理中
- `4`: 登录成功，返回 `token / userid`

**必选参数：**

`key`: `/login/qr/key` 返回的 key

**接口地址：** `/login/qr/check`

**调用例子：**

```text
/raw-api/login/qr/check?key=xxx&platform=life&timestamp=1691256061923
```

## 刷新登录

说明：刷新登录状态，延长 token 有效期。

**可选参数：**

`token`: 登录返回的 token

`userid`: 登录返回的用户 id

**接口地址：** `/login/token`

**调用例子：**

```text
/raw-api/login/token?token=xxx&userid=123&platform=life&timestamp=1691256061923
```

## dfid 获取

说明：获取设备标识 `dfid`，播放 URL 和部分登录链路会用到。

**接口地址：** `/register/dev`

**调用例子：**

```text
/raw-api/register/dev?platform=life&timestamp=1691256061923
```

## 搜索

说明：第三方稳定接入建议优先使用 `/api` 网关，不直接依赖上游 `/raw-api/search`。

网关基础地址：

```text
http://47.116.42.11/api
```

### 歌曲搜索

**接口地址：** `/api/search/songs`

**必选参数：**

`q`: 搜索关键词

**可选参数：**

`page`: 页码，默认 `1`

`pageSize`: 每页数量，默认 `20`

**调用例子：**

```text
/api/search/songs?q=周杰伦&pageSize=20
```

### 歌单搜索

**接口地址：** `/raw-api/search`

**调用例子：**

```text
/raw-api/search?keywords=周杰伦&type=special&pagesize=20&platform=life
```

### 专辑搜索

**接口地址：** `/api/search/albums`

**调用例子：**

```text
/api/search/albums?q=周杰伦&pageSize=20
```

### 歌手搜索

**接口地址：** `/api/search/artists`

**调用例子：**

```text
/api/search/artists?q=周杰伦&pageSize=20
```

### MV 搜索

**接口地址：** `/api/search/mvs`

**调用例子：**

```text
/api/search/mvs?q=周杰伦&pageSize=20
```

## 歌单音乐列表

说明：获取用户歌单内的歌曲。当前前端用于“我的歌单”和歌单搜索结果。

**接口地址：** `/playlist/track/all`

**必选参数：**

`id`: 歌单 id

**可选参数：**

`pagesize`: 每页数量，当前前端使用 `100`

**调用例子：**

```text
/raw-api/playlist/track/all?id=xxx&pagesize=100&cookie=token=xxx;userid=xxx;dfid=xxx
```

## 专辑音乐列表

**接口地址：** `/api/albums/:albumId/tracks`

**调用例子：**

```text
/api/albums/960399/tracks?pageSize=200
```

## 歌手单曲

**接口地址：** `/api/artists/:artistId/tracks`

**调用例子：**

```text
/api/artists/3520/tracks?pageSize=200
```

## 获取音乐 URL

说明：网关播放接口会优先尝试原始音源，必要时做 fallback 匹配。

**接口地址：** `/api/songs/:hash/play-url`

**可选参数：**

`albumId`: 专辑 id

`albumAudioId`: 专辑音频 id

`title`: 歌曲名，建议传

`artist`: 歌手名，建议传

**调用例子：**

```text
/api/songs/B3A52A7A958BF0AED0EBFBA2E9A818B7/play-url?albumId=966846&albumAudioId=32100650&title=晴天&artist=周杰伦
```

### 无音源约定

如果返回以下结构，前端直接跳过，不再当作普通错误重试：

```json
{"code":4404,"message":"no playable source","data":{"status":0,"msg":{}}}
```

这类情况通常对应酷狗客户端中的“原版本无音源，但推荐版本可播放”。开放接口未必能自动拿到替代源。

## 获取歌词

当前前端歌词链路分两步：先搜索歌词候选，再用 `id / accesskey` 获取 LRC。

### 歌词搜索

**接口地址：** `/search/lyric`

**调用例子：**

```text
/raw-api/search/lyric?keywords=晴天&duration=317000&hash=xxx&album_audio_id=xxx&platform=life
```

### 获取歌词

**必选参数：**

`id`: 歌词 id

`accesskey`: 歌词 accesskey

**接口地址：** `/lyric`

**调用例子：**

```text
/raw-api/lyric?id=xxx&accesskey=xxx&fmt=lrc&decode=true&platform=life
```

## 获取封面

说明：当前前端封面获取保留走原始接口。

**接口地址：** `/images`

**调用例子：**

```text
/raw-api/images?hash=xxx&album_id=xxx&album_audio_id=xxx&count=1&platform=life
```

## 获取视频 URL

**接口地址：** `/api/mvs/:mvHash/play-url`

**调用例子：**

```text
/api/mvs/3B1F32C55F9774501794213C09168A18/play-url
```

## 前端调用和第三方调用区别

### 前端当前做法

- 搜索、专辑、歌手、MV、播放地址优先走 `/api`
- 登录、token 刷新、验证码、二维码、歌词、封面走 `/raw-api`
- 本地保存 `token / userid / dfid`
- 请求阶段统一拼接 `cookie` 参数
- token 支持定时刷新和失败自动重试
- 无音源歌曲直接标记跳过

### 第三方推荐做法

- 对外稳定接入优先使用 `/api`
- 不建议第三方直接依赖 `/raw-api/search`
- 无音源歌曲单独做分支处理，不要混成普通错误
- 登录态尽量维护在你自己的服务端，不要直接复用浏览器本地 token
