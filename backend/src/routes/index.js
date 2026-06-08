const router = require("express").Router();

router.use("/auth",       require("./auth.routes"));
router.use("/villages",   require("./village.routes"));
router.use("/households", require("./household.routes"));
router.use("/members",    require("./member.routes"));
router.use("/movements",  require("./movement.routes"));
router.use("/reports",    require("./report.routes"));
router.use("/zalo",       require("./zalo.routes"));
router.use("/notify",     require("./notification.routes"));

module.exports = router;
