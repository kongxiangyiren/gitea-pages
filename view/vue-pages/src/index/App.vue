<template>
  <div>
    <div class="top">
      <a href="/">
        <img src="@/assets/gitea.svg" />
        Pages
      </a>
    </div>

    <div class="row">
      <div class="col">
        <div class="circle">1</div>
        <h4>Set up your repository</h4>
        <p>
          Create a public repository named
          <code class="code">pages</code>
          to make the site available at the main subdomain.
        </p>
      </div>
      <div class="col">
        <div class="circle">2</div>
        <h4>Upload your files</h4>
        <p>Push your static content, HTML, style, fonts, images or anything else.</p>
      </div>
      <div class="col">
        <div class="circle">3</div>
        <h4>You're done!</h4>
        <p>
          Access your new website using this link:
          <code class="code">{{ protocol }}//USERNAME.{{ host }}</code>
        </p>
        <div class="divider">
          <hr />
          or
          <hr />
        </div>
        <p>
          To use a custom domain, create a file
          <code class="code">CNAME</code>
          in your repository with the domain name you wish to use.
        </p>
        <p>
          Then, add a CNAME record for that domain:
          <code class="code">USERNAME.{{ host }}</code>
        </p>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
  const protocol = location.protocol,
    host = location.host;
</script>
<style scoped lang="scss">
  .top {
    background-color: #222222;
    height: 50px;

    a {
      font-size: 30px;
      height: 100%;
      display: flex;
      align-items: center;
      text-decoration: none;
      color: #fff;

      img {
        width: 35px;
        margin: 0 3px 0 30px;
      }
    }
  }

  .row {
    display: flex;
    justify-content: space-between;
    width: 80%;
    margin: 30px auto 0;
    border: #ccc 1px solid;
    border-radius: 5px;
    padding: 20px;

    .col {
      width: 100%;
      text-align: center;

      .circle {
        background-color: #144b49;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        color: #fff;
        margin: 0 auto;
      }

      h4 {
        font-size: 24px;
        line-height: 1.45;
        margin-top: 10px;
        margin-bottom: 20px;
        font-weight: 400;
      }

      p {
        font-size: 14px;

        code {
          font-size: 12px;
          line-height: 1.5;
          padding: 1px 5px;
          margin: 0 1px;
          background-color: #ecf0fe;
          border: 1px solid rgba($color: #000000, $alpha: 0.05);
          border-radius: 2px;
        }
      }

      .divider {
        display: flex;
        align-items: center;
        margin: 20px;

        hr {
          height: 1px;
          border: 0;
          background-color: rgba($color: #000000, $alpha: 0.1);
          color: rgba($color: #000000, $alpha: 0.1);
          flex-basis: 50%;

          &:first-child {
            margin-right: 1rem;
          }

          &:last-child {
            margin-left: 1rem;
          }
        }
      }
    }
  }
</style>
