import validator from 'validator';
validator.toString =  (input: any) => {
  return String(input);
};
export default class extends think.Logic {
  __before() {
    this.header('X-Powered-By', 'gitea-pages');
  }
}
