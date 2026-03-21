export class TenantStateDO {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    return Response.json({
      durable_object: 'TenantStateDO',
      status: 'scaffolded'
    });
  }
}
