const url = "https://yanwashere.github.io/exchange/exchange_rate.json"
const req = new Request(url)
const data = await req.loadJSON()

const w = new ListWidget()
w.backgroundColor = new Color("#3d2b1f")

const title = w.addText("RY Exchange")
title.textColor = Color.white()
title.font = Font.boldSystemFont(14)

w.addSpacer(4)

const rub = w.addText(`₽ → ¥  ${data.rub} `)
rub.textColor = new Color("#f5c842")
rub.font = Font.systemFont(13)

const usdt = w.addText(`USDT → ¥  ${data.usdt_cny}`)
usdt.textColor = Color.white()
usdt.font = Font.systemFont(13)

w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000)

Script.setWidget(w)
w.presentSmall()
