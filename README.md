# Mini Max

Projeto web interativo para visualizar o funcionamento do algoritmo Minimax em um jogo da velha 3x3.

O jogador humano enfrenta uma IA, enquanto a interface mostra a arvore de decisao da jogada atual, destacando:

- nos de maximizacao da IA;
- nos de minimizacao do humano;
- utilidades terminais dos estados folha;
- caminho escolhido pela IA;
- animacao da busca com controle de velocidade;
- zoom na arvore para inspecao visual.

## Tecnologias

- React 18 via ESM CDN
- JavaScript puro para a logica do Minimax
- SVG para renderizacao da arvore
- CSS customizado para a interface

## Estrutura do projeto

- `index.html`: ponto de entrada da aplicacao
- `app.js`: logica do jogo, Minimax, arvore visual e componentes React
- `styles.css`: estilo visual da interface

## Como executar localmente

Na pasta do projeto, inicie um servidor HTTP simples:

```powershell
py -m http.server 5500
```

Depois abra no navegador:

```text
http://localhost:5500
```

Se o navegador mantiver uma versao em cache, use `Ctrl + F5`.

## Como usar

1. Clique em uma casa vazia para fazer sua jogada.
2. Aguarde a animacao da busca da IA.
3. Observe a arvore Minimax sendo destacada durante a avaliacao.
4. Use o slider para alterar a velocidade da busca.
5. Use os controles `-`, `+` e `100%` para ajustar o zoom da arvore.
6. Use o botao de reinicio para começar uma nova partida.

## Logica do algoritmo

A aplicacao separa a decisao da IA da visualizacao:

- a jogada ideal da IA e calculada com Minimax usando poda alpha-beta;
- a arvore mostrada na interface e um recorte didatico dos ramos mais relevantes;
- os scores mostrados nos nos continuam consistentes com a avaliacao do algoritmo.

Utilidades terminais:

- `+1`: vitoria da IA
- `0`: empate
- `-1`: vitoria do humano

## Objetivo didatico

Este projeto foi construido para demonstrar, de forma visual, como o Minimax percorre estados de jogo, compara utilidades e escolhe a melhor acao sob a hipotese de um adversario racional.
