export default class extends think.Logic {
  __before() {
    this.header('X-Powered-By', 'gitea-pages');
  }
}
