const env = require('../.env')
const common = require('../common.env')
const { Telegraf, Markup } = require('telegraf')
const fetch = require("node-fetch")
const LocalSession = require('telegraf-session-local')
const request = require('request')

const categories = common.categories;
var books = common.books;
const actions = ['Listar locações', 'Cadastrar nova locação',  'Excluir locação', 'Atualizar locação']

const bot = new Telegraf(env.token)

var apiToken = '';

bot.use(new LocalSession({ database: 'example_db.json' }).middleware())

async function updateAPIToken() {
    var body = {
        email: env.apicredentials.email, 
        password: env.apicredentials.password
    }
    fetch(env.apiBase + '/users/login', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
            'Content-Type': 'application/json'
        }
    }).then(res => res.json())
        .then(json => apiToken = json.token)
        .catch (err => console.log(err))
}

updateAPIToken();

async function createhire(usuario, categories, dias, livro) {
    updateAPIToken();
    var body = {
        usuario: usuario, 
        categories: categories,
        dias: dias,
        livro: livro
    }
    var response;
    fetch(env.apiBase + '/hires', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
            'Content-Type': 'application/json',
            'x-access-token': apiToken
        }
    }).then(res => res.json())
        .then(json => response = json)
        .catch (err => console.log(err))
    return await response;
}

async function updatehire(id, dias) {
    updateAPIToken();
    var body = {
        dias: dias
    }
    var response;
    fetch(env.apiBase + '/hire/' + id, {
        method: 'PUT',
        body: JSON.stringify(body),
        headers: {
            'Content-Type': 'application/json',
            'x-access-token': apiToken
        }
    }).then(res => res.json())
        .then(json => response = json.message)
        .catch (err => console.log(err))
    return await response;
}

bot.start(async ctx => {
    const from = ctx.update.message.from
    await ctx.reply(`Olá! Seja bem vindo ${from.first_name}`)
    await ctx.reply(
        `Eu sou o bot de locação de livros, criado por André.
        Minha função é salvar suas locações para não esquecer de devolvelos. Qual categoria locou?`,
        Markup.keyboard(categories).resize().oneTime()
    )
})

bot.hears(categories, async ctx => {
    updateAPIToken();
    await ctx.reply(` Legal! Qual livro escolheu? `)
    var message = ctx.message.text
    request(`${env.apicategoriess}/${message}`, async (err, res, body) => {
        var response = JSON.parse(body)
        var keyboardvalues = []
        response.forEach(element => {
            keyboardvalues.push(element.livro)
        });
        await ctx.reply(
            `Aqui estão todos dessa categoria:`,
            Markup.keyboard(keyboardvalues).resize().oneTime()
        )}
    )
})

 

bot.hears(books, async ctx => {
    var currentbooks = ctx.update.message.text
    ctx.session.currentbooks = currentbooks;
    ctx.session.action = 'create';
    await ctx.reply('Interessante! E qual foi o dia que pegou esse livro?')
})

let list = []

  // criando um 'Inline Keyboar' dinâmico
const itemsButtons = () =>
    Markup.inlineKeyboard(
    list.map(item => Markup.button.callback(item, `remove ${item}`)),
    { columns: 3 }
)

// obtendo o item e o transformando em um botão da lista
const onlyNumbers = new RegExp('^[0-9]+$')

bot.hears(onlyNumbers, async ctx => {
    var message = ctx.update.message.text
    if (message.length === 4) {
        var action = ctx.session.action;
    
        switch (action) {
            case 'create':
                list.push(ctx.update.message.text)
                console.log(list)
                var currentbooks = ctx.session.currentbooks
                var days = ctx.update.message.text
                var userID = ctx.update.message.from.id
                var livro = ctx.update.message.from.first_name
    
                await createhire(userID, currentbooks, days, livro)
    
                ctx.reply(
                    `A locação do livro ${currentbooks} pego no dia ${ctx.update.message.text} foi adicionada à lista! O que deseja fazer agora?`,
                    Markup.keyboard(actions).resize().oneTime(),
                    itemsButtons()
                )
                ctx.session.currentbooks = null;
                ctx.session.action = null;
                break;
            case 'update':
                hireID = ctx.session.currenthire;
                var days = ctx.update.message.text
                await updatehire(hireID, days);
                ctx.reply(
                    `A locação foi alterada com sucesso! O que deseja fazer agora?`,
                    Markup.keyboard(actions).resize().oneTime(),
                    itemsButtons()
                )
                ctx.session.currenthire = null;
                ctx.session.action = null;
                break;
            default:
                ctx.session.currentbooks = null;
                ctx.session.currenthire = null;
                ctx.session.action = null;
                ctx.reply(
                    `Não entendi a sua solicitação, o que devemos fazer agora?`,
                    Markup.keyboard(actions).resize().oneTime(),
                    itemsButtons()
                )
                break;
        }
    } else {
        ctx.reply(
            `Por gentileza, digite um dia valido`
        )
    }
})
     
   // removendo os itens da lista quando clicar no botão
bot.action(/remove (.+)/, ctx => {
    var id = ctx.match[1]

    fetch(env.apiBase + '/hire/' + id, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'x-access-token': apiToken
        }
    }).then(res => res.json())
    .then((json) => {

        ctx.reply(
            `A locação foi removida da sua lista!`,
            Markup.keyboard(actions).resize().oneTime(),
            itemsButtons()
        )
    })
})

bot.action(/update (.+)/, ctx => {
    var id = ctx.match[1]

    ctx.session.currenthire = id;
    ctx.session.action = 'update';

    ctx.reply('Para qual dia da locação você gostaria de alterar?')
})

bot.hears('Cadastrar nova locação',
ctx => {
    ctx.reply( 'Qual categoria escolheu?',
    Markup.keyboard(categories).resize().oneTime()
)})
  
bot.hears('Listar locações',ctx => {
    updateAPIToken();
    var userID = ctx.update.message.from.id

    fetch(env.apiBase + '/hire/' + userID, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'x-access-token': apiToken
        }
    }).then(res => res.json())
    .then((json) => {

        const myhire = () =>
        Markup.inlineKeyboard(
            json.map(
                item => Markup.button.callback(item.categories + ' - ' + item.dias, `${item.categories}`)
            ),
            { columns: 2 }
        )
    
        ctx.reply(
            'Aqui estão todas as suas locações cadastradas:',
            myhire()
        ).then(() => {
            ctx.reply(
                'O que devemos fazer agora?',
                Markup.keyboard(actions).resize().oneTime(),
                itemsButtons()
            )
        })
        
    })
    .catch (err => console.log(err))
    
})

bot.hears('Excluir locação',ctx => {
    var userID = ctx.update.message.from.id
  
    fetch(env.apiBase + '/hire/' + userID, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'x-access-token': apiToken
        }
    }).then(res => res.json())
    .then((json) => {

        var myhire = () => Markup.inlineKeyboard(
            json.map(
                item => Markup.button.callback(item.categories + ' - ' + item.dias, `remove ${item.id}`)
            ),
            { columns: 2 }
        )
        

        ctx.reply(
            'Clique sobre uma das locações de sua lista para excluir. Essa ação não será desfeita.',
            myhire()
        )
    })
})

bot.hears('Atualizar locação',ctx => {
    var userID = ctx.update.message.from.id
  
    fetch(env.apiBase + '/hire/' + userID, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'x-access-token': apiToken
        }
    }).then(res => res.json())
    .then((json) => {

        var myhire = () => Markup.inlineKeyboard(
            json.map(
                item => Markup.button.callback(item.categories + ' - ' + item.dias, `update ${item.id}`)
            ),
            { columns: 2 }
        )
        

        ctx.reply(
            'Clique sobre uma das locações de sua lista para alterar. Essa ação não será desfeita.',
            myhire()
        )
    })
})


bot.startPolling()