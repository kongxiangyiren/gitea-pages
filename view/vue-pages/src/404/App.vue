<script setup lang="ts">

</script>

<template>
  <div class="container">

    <h1>404</h1>
    <p><strong>There isn't a Gitea Pages site here.</strong></p>
    <p>If you are trying to publish a <strong>Gitea Pages</strong>, please go to
      <a href="http://gitea.com" target="_blank" rel="noopener noreferrer">gitea</a>
      to create a pages repository and use its main branch hosting page.
    </p>

    <div id="suggestions">
      <a href="https://gitea.com/">Gitea</a> —
      <a href="https://gitea.com/kongxiangyiren/gitea-pages">Gitea Pages</a>
    </div>
    <a href="/" class="logo">
      <img src="@/assets/gitea.svg">
    </a>
  </div>
</template>

<style scoped lang="scss">
.container {
  margin: 50px auto 40px auto;

  text-align: center;

  a {
    color: #4183c4;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  h1 {
    position: relative;
    letter-spacing: -1px;
    line-height: 60px;
    font-size: 60px;
    font-weight: 100;
    margin: 0px 0 50px 0;
    text-shadow: 0 1px 0 #fff;
  }

  p {
    color: rgba(0, 0, 0, 0.5);
    margin: 20px auto;
    line-height: 1.6;
    max-width: 500px;
  }

  #suggestions {
    margin-top: 35px;
    color: #ccc;

    a {
      color: #666666;
      font-weight: 200;
      font-size: 14px;
      margin: 0 10px;
    }
  }

  .logo {
    display: inline-block;
    margin-top: 20px;

    img {
      width: 40px;
    }
  }


}
</style>
